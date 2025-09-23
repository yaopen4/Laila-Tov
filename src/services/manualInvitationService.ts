// Manual Invitation Service - Foundation for Email Invitation System
// This service creates invitations and generates codes without sending emails
// Admin can manually copy and share invitation codes

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  arrayUnion 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  Invitation as AppInvitation,
  CreateInvitationParams,
  InvitationHistoryEntry,
  User as AppUser
} from '@/types/auth';
import { AuditLogger } from './auditLogger';

export interface ManualInvitationResult {
  success: boolean;
  invitation?: AppInvitation;
  invitationCode?: string;
  error?: string;
}

export interface CreateManualInvitationParams {
  email: string;
  role: 'admin' | 'coach' | 'parent';
  organizationId: string;
  createdBy: string;
  metadata?: {
    babyProfileId?: string;
    assignedCoachId?: string;
    welcomeMessage?: string;
    customInstructions?: string;
  };
}

export class ManualInvitationService {
  private readonly EXPIRY_DAYS = 7;
  
  /**
   * Create a new invitation with manual code generation (no email sending)
   */
  async createManualInvitation(params: CreateManualInvitationParams): Promise<ManualInvitationResult> {
    try {
      // Validate input
      if (!params.email || !params.role || !params.organizationId || !params.createdBy) {
        return {
          success: false,
          error: 'Missing required parameters'
        };
      }

      // Check if user already exists
      const existingUser = await this.getUserByEmail(params.email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Check for existing pending invitation
      const existingInvitation = await this.getPendingInvitationByEmail(params.email);
      if (existingInvitation) {
        return {
          success: false,
          error: 'Pending invitation already exists for this email'
        };
      }

      // Generate unique invitation code
      const invitationCode = await this.generateUniqueCode();
      
      // Create invitation document
      const invitationRef = doc(collection(db, 'invitations'));
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);
      
      const invitation: AppInvitation = {
        id: invitationRef.id,
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
          action: 'created_manually',
          performedBy: params.createdBy,
          details: `Manual invitation created for ${params.role} role - code: ${invitationCode}`
        }]
      };
      
      // Save to Firestore
      await setDoc(invitationRef, invitation);
      
      // Create placeholder user for the invitation
      await this.createPlaceholderUser(invitation);
      
      // Log audit event
      await AuditLogger.log({
        action: 'manual_invitation_created',
        userId: params.createdBy,
        targetType: 'invitation',
        targetId: invitation.id,
        details: {
          email: invitation.email,
          role: invitation.role,
          organizationId: invitation.organizationId,
          invitationCode: invitationCode,
          expiresAt: invitation.expiresAt.toDate().toISOString()
        }
      });
      
      return {
        success: true,
        invitation,
        invitationCode
      };
      
    } catch (error) {
      console.error('Error creating manual invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invitation'
      };
    }
  }

  /**
   * Get invitation by code for validation
   */
  async getInvitationByCode(code: string): Promise<EnhancedInvitation | null> {
    // Renamed to use standard types
    type EnhancedInvitation = AppInvitation;
    try {
      const q = query(
        collection(db, 'invitations'),
        where('invitationCode', '==', code)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      
      return snapshot.docs[0].data() as EnhancedInvitation;
    } catch (error) {
      console.error('Error getting invitation by code:', error);
      return null;
    }
  }

  /**
   * Accept invitation using code (for when user signs up)
   */
  async acceptInvitationWithCode(invitationCode: string, userUID: string): Promise<{
    success: boolean;
    user?: AppUser;
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
      
      // Log successful acceptance
      await AuditLogger.log({
        action: 'invitation_accepted_manually',
        userId: userUID,
        targetType: 'invitation',
        targetId: invitation.id,
        details: {
          email: invitation.email,
          role: invitation.role,
          organizationId: invitation.organizationId,
          invitationCode
        }
      });
      
      return { success: true, user };
      
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: 'Failed to accept invitation' };
    }
  }

  /**
   * Get all pending invitations for an organization
   */
  async getPendingInvitations(organizationId: string): Promise<AppInvitation[]> {
    try {
      const q = query(
        collection(db, 'invitations'),
        where('organizationId', '==', organizationId),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as AppInvitation);
    } catch (error) {
      console.error('Error getting pending invitations:', error);
      return [];
    }
  }

  /**
   * Cancel/revoke an invitation
   */
  async cancelInvitation(invitationId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'cancelled',
      history: arrayUnion({
        timestamp: Timestamp.now(),
        action: 'cancelled_manually',
        performedBy: userId,
        details: 'Invitation cancelled manually by admin'
      })
    });
    
    await AuditLogger.log({
      action: 'invitation_cancelled_manually',
      userId: userId,
      targetType: 'invitation',
      targetId: invitationId,
      details: {
        reason: 'manual_cancellation'
      }
    });
  }

  // Private helper methods

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

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Excluding O, 0 for clarity
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async getUserByEmail(email: string): Promise<AppUser | null> {
    const q = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data() as AppUser;
  }

  private async getPendingInvitationByEmail(email: string): Promise<AppInvitation | null> {
    const q = query(
      collection(db, 'invitations'),
      where('email', '==', email.toLowerCase()),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data() as AppInvitation;
  }

  private async validateInvitation(invitation: AppInvitation): Promise<{isValid: boolean, reason?: string}> {
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
    
    return { isValid: true };
  }

  private async createUserFromInvitation(
    invitation: AppInvitation, 
    userUID: string
  ): Promise<AppUser> {
    const user: AppUser = {
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
    
    // Log user creation
    await AuditLogger.log({
      action: 'user_registered_manual',
      userId: userUID,
      targetType: 'user',
      targetId: userUID,
      details: {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        invitationId: invitation.id
      }
    });
    
    return user;
  }

  private async createPlaceholderUser(invitation: AppInvitation): Promise<void> {
    // Create a placeholder user record that will be activated when the user signs up
    const placeholderUser: Partial<AppUser> = {
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
      status: 'pending_invitation', // Special status for placeholder users
      assignedCoachId: invitation.metadata.assignedCoachId,
      managedBabyProfiles: invitation.metadata.babyProfileId ? 
        [invitation.metadata.babyProfileId] : [],
      createdAt: Timestamp.now(),
      originalInvitationId: invitation.id,
      preferences: {
        language: 'he',
        timezone: 'Asia/Jerusalem',
        notifications: {
          email: true,
          push: true,
          reminders: true
        }
      }
    };
    
    // Store placeholder user with invitation ID as document ID for easy lookup
    await setDoc(doc(db, 'placeholder_users', invitation.id), placeholderUser);
  }

  private async performRoleSpecificSetup(
    invitation: AppInvitation, 
    user: AppUser
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

  private async addParentToBabyProfile(babyProfileId: string, parentId: string): Promise<void> {
    const babyRef = doc(db, 'baby_profiles', babyProfileId);
    await updateDoc(babyRef, {
      parentIds: arrayUnion(parentId),
      lastUpdatedAt: Timestamp.now()
    });
    
    await AuditLogger.log({
      action: 'parent_added_to_baby_manual',
      userId: parentId,
      targetType: 'baby_profile',
      targetId: babyProfileId,
      details: {
        parentId,
        method: 'manual_invitation_acceptance'
      }
    });
  }

  private async initializeCoachWorkspace(user: AppUser): Promise<void> {
    // Initialize coach-specific data and settings
    console.log('Initializing coach workspace for:', user.uid);
  }

  private async initializeAdminPermissions(user: AppUser): Promise<void> {
    // Set up admin-specific permissions and access
    console.log('Initializing admin permissions for:', user.uid);
  }

  private getDefaultPermissions(role: string): string[] {
    const permissions = {
      admin: [
        'users.create', 'users.read.all', 'users.update.all', 'users.deactivate',
        'babies.create', 'babies.read.all', 'babies.update.assigned', 'babies.archive',
        'sleep_data.read.all', 'sleep_data.write.assigned',
        'reports.generate.all', 'reports.export',
        'system.manage_roles', 'system.manage_organization', 
        'system.view_audit_logs', 'system.manage_invitations'
      ],
      coach: [
        'users.read.assigned',
        'babies.create', 'babies.read.assigned', 'babies.update.assigned', 'babies.archive',
        'sleep_data.read.assigned', 'sleep_data.write.assigned',
        'reports.generate.assigned', 'reports.export',
        'system.manage_invitations'
      ],
      parent: [
        'babies.read.assigned',
        'sleep_data.read.assigned', 'sleep_data.write.assigned',
        'reports.generate.assigned'
      ]
    };
    
    return permissions[role] || [];
  }

  private async markInvitationAccepted(id: string, userUID: string): Promise<void> {
    await updateDoc(doc(db, 'invitations', id), {
      status: 'accepted',
      acceptedAt: Timestamp.now(),
      acceptedBy: userUID,
      history: arrayUnion({
        timestamp: Timestamp.now(),
        action: 'accepted_manually',
        performedBy: userUID,
        details: 'User completed registration with manual invitation code'
      })
    });
  }

  private async markInvitationExpired(id: string): Promise<void> {
    await updateDoc(doc(db, 'invitations', id), {
      status: 'expired',
      history: arrayUnion({
        timestamp: Timestamp.now(),
        action: 'expired',
        performedBy: 'system',
        details: 'Invitation automatically expired'
      })
    });
    
    await AuditLogger.log({
      action: 'invitation_expired_manual',
      userId: 'system',
      targetType: 'invitation',
      targetId: id,
      details: {
        reason: 'automatic_expiry'
      }
    });
  }
}
