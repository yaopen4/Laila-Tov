// services/invitationService.ts

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateInvitationCode, sendInvitationEmail } from '@/lib/utils';

export class InvitationService {
  private readonly EXPIRY_DAYS = 7;
  
  /**
   * Create a new invitation
   */
  async createInvitation(params: CreateInvitationParams): Promise<Invitation> {
    const invitationCode = await this.generateUniqueCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);
    
    const invitation: Invitation = {
      id: doc(collection(db, 'invitations')).id,
      invitationCode,
      email: params.email.toLowerCase().trim(),
      role: params.role,
      organizationId: params.organizationId,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      createdBy: params.createdBy,
      metadata: params.metadata || {},
      history: [{
        timestamp: Timestamp.now(),
        action: 'created',
        performedBy: params.createdBy,
        details: `Invitation created for ${params.role} role`
      }]
    };
    
    // Save to Firestore
    await setDoc(doc(db, 'invitations', invitation.id), invitation);
    
    // Send invitation email
    await this.sendInvitationEmail(invitation);
    
    // Log email sent
    await this.addHistoryEntry(invitation.id, {
      timestamp: Timestamp.now(),
      action: 'sent',
      performedBy: params.createdBy,
      details: `Invitation email sent to ${invitation.email}`
    });
    
    return invitation;
  }
  
  /**
   * Accept an invitation using the invitation code
   */
  async acceptInvitation(invitationCode: string, userUID: string): Promise<{
    success: boolean;
    user?: User;
    error?: string;
  }> {
    try {
      // Find invitation by code
      const invitation = await this.getInvitationByCode(invitationCode);
      
      if (!invitation) {
        return { success: false, error: 'Invalid invitation code' };
      }
      
      // Validate invitation
      const validation = await this.validateInvitation(invitation);
      if (!validation.isValid) {
        return { success: false, error: validation.reason };
      }
      
      // Create/update user record
      const user = await this.createUserFromInvitation(invitation, userUID);
      
      // Mark invitation as accepted
      await this.markInvitationAccepted(invitation.id, userUID);
      
      // Handle role-specific setup
      await this.performRoleSpecificSetup(invitation, user);
      
      return { success: true, user };
      
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: 'Failed to accept invitation' };
    }
  }
  
  /**
   * Validate invitation status and expiry
   */
  private async validateInvitation(invitation: Invitation): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    // Check if already accepted
    if (invitation.status === 'accepted') {
      return { isValid: false, reason: 'Invitation has already been accepted' };
    }
    
    // Check if cancelled
    if (invitation.status === 'cancelled') {
      return { isValid: false, reason: 'Invitation has been cancelled' };
    }
    
    // Check if expired
    if (invitation.status === 'expired' || invitation.expiresAt.toDate() < new Date()) {
      // Auto-mark as expired if not already
      if (invitation.status !== 'expired') {
        await this.markInvitationExpired(invitation.id);
      }
      return { isValid: false, reason: 'Invitation has expired' };
    }
    
    // Check if user already exists with this email
    const existingUser = await this.getUserByEmail(invitation.email);
    if (existingUser) {
      return { isValid: false, reason: 'User with this email already exists' };
    }
    
    return { isValid: true };
  }
  
  /**
   * Create user from invitation data
   */
  private async createUserFromInvitation(
    invitation: Invitation, 
    userUID: string
  ): Promise<User> {
    const user: User = {
      uid: userUID,
      email: invitation.email,
      emailVerified: true, // Firebase Auth handles this
      displayName: '', // User will complete profile
      role: invitation.role,
      organizationId: invitation.organizationId,
      permissions: this.getDefaultPermissions(invitation.role),
      status: 'active',
      assignedCoachId: invitation.metadata.assignedCoachId,
      managedBabyProfiles: invitation.metadata.babyProfileId ? 
        [invitation.metadata.babyProfileId] : [],
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      invitationAcceptedAt: Timestamp.now(),
      originalInvitationId: invitation.id,
      preferences: {
        language: 'he', // Default to Hebrew
        timezone: 'Asia/Jerusalem',
        notifications: {
          email: true,
          push: true,
          reminders: true
        }
      }
    };
    
    await setDoc(doc(db, 'users', userUID), user);
    return user;
  }
  
  /**
   * Handle role-specific setup after user creation
   */
  private async performRoleSpecificSetup(
    invitation: Invitation, 
    user: User
  ): Promise<void> {
    switch (invitation.role) {
      case 'parent':
        // Add parent to baby profile
        if (invitation.metadata.babyProfileId) {
          await this.addParentToBabyProfile(
            invitation.metadata.babyProfileId, 
            user.uid
          );
        }
        break;
        
      case 'coach':
        // Set up coach workspace
        await this.initializeCoachWorkspace(user);
        break;
        
      case 'admin':
        // Set up admin permissions
        await this.initializeAdminPermissions(user);
        break;
    }
  }
  
  /**
   * Generate unique invitation code
   */
  private async generateUniqueCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const code = this.generateRandomCode();
      
      // Check if code already exists
      const q = query(
        collection(db, 'invitations'),
        where('invitationCode', '==', code),
        where('status', '!=', 'expired')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return code;
      }
      
      attempts++;
    }
    
    throw new Error('Unable to generate unique invitation code');
  }
  
  /**
   * Generate random 8-character code
   */
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Excluding O, 0 for clarity
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(role: string): string[] {
    const permissions = {
      admin: [
        'manage_users',
        'manage_invitations', 
        'view_all_data',
        'export_data',
        'manage_settings'
      ],
      coach: [
        'manage_baby_profiles',
        'view_assigned_data',
        'create_recommendations',
        'invite_parents',
        'export_client_data'
      ],
      parent: [
        'log_sleep_data',
        'view_own_data',
        'view_recommendations'
      ]
    };
    
    return permissions[role] || [];
  }
  
  /**
   * Send invitation email
   */
  private async sendInvitationEmail(invitation: Invitation): Promise<void> {
    const emailService = new EmailService();
    
    const template = await this.getInvitationTemplate(
      invitation.organizationId, 
      invitation.role
    );
    
    const emailContent = this.populateTemplate(template, {
      invitationCode: invitation.invitationCode,
      inviterName: await this.getInviterName(invitation.createdBy),
      organizationName: await this.getOrganizationName(invitation.organizationId),
      role: invitation.role,
      expiryDate: invitation.expiresAt.toDate().toLocaleDateString('he-IL')
    });
    
    await emailService.sendEmail({
      to: invitation.email,
      subject: emailContent.subject,
      html: emailContent.body,
      priority: 'normal'
    });
  }
  
  // Additional helper methods...
  async getInvitationByCode(code: string): Promise<Invitation | null> { /* Implementation */ }
  async markInvitationAccepted(id: string, userUID: string): Promise<void> { /* Implementation */ }
  async addHistoryEntry(id: string, entry: InvitationHistoryEntry): Promise<void> { /* Implementation */ }
  // ... more helper methods
}

interface CreateInvitationParams {
  email: string;
  role: 'admin' | 'coach' | 'parent';
  organizationId: string;
  createdBy: string;
  metadata?: {
    babyProfileId?: string;
    assignedCoachId?: string;
    permissions?: string[];
    welcomeMessage?: string;
  };
}