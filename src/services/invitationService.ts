// Invitation Service with Advanced Features
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
  Invitation,
  CreateInvitationParams,
  InvitationHistoryEntry,
  User,
  ValidationResult,
  InvitationTemplate
} from '@/types/auth';
import { AuditLogger } from './auditLogger';
import { EmailService } from './emailService';
import { EmailTemplateService } from './emailTemplateService';

export class InvitationService {
  private readonly EXPIRY_DAYS = 7;
  
  /**
   * Pre-validate an invitation code and email before registration
   */
  async prevalidateInvitation(invitationCode: string, email: string): Promise<{
    isValid: boolean;
    reason?: string;
    role?: User['role'];
    organizationId?: string;
    invitationEmail?: string;
  }> {
    try {
      const code = (invitationCode || '').trim().toUpperCase();
      const normalizedEmail = (email || '').toLowerCase().trim();

      if (!code || code.length !== 8) {
        return { isValid: false, reason: 'Invitation code must be 8 characters long' };
      }
      
      const invitation = await this.getInvitationByCode(code);
      if (!invitation) {
        return { isValid: false, reason: 'Invalid invitation code' };
      }

      // Validate base invitation constraints
      const validation = await this.validateInvitation(invitation);
      if (!validation.isValid) {
        return { isValid: false, reason: validation.reason };
      }

      // Ensure email matches the invitation
      if (invitation.email.toLowerCase() !== normalizedEmail) {
        return { isValid: false, reason: 'Email does not match invitation', invitationEmail: invitation.email };
      }

      return {
        isValid: true,
        role: invitation.role,
        organizationId: invitation.organizationId,
        invitationEmail: invitation.email
      };
    } catch (error) {
      console.error('Error prevalidating invitation:', error);
      return { isValid: false, reason: 'Failed to validate invitation' };
    }
  }
  
  /**
   * Create a new invitation with advanced features
   */
  async createInvitation(params: CreateInvitationParams): Promise<Invitation> {
    const invitationCode = await this.generateUniqueCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);
    
    const invitationRef = doc(collection(db, 'invitations'));
    const invitation: Invitation = {
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
        action: 'created',
        performedBy: params.createdBy,
        details: `Invitation created for ${params.role} role`
      }]
    };
    
    // Save to Firestore
    await setDoc(invitationRef, invitation);
    
    // Log audit event
    await AuditLogger.log({
      action: 'invitation_created',
      userId: params.createdBy,
      targetType: 'invitation',
      targetId: invitation.id,
      details: {
        email: invitation.email,
        role: invitation.role,
        organizationId: invitation.organizationId,
        expiresAt: invitation.expiresAt.toDate().toISOString()
      }
    });
    
    // Send invitation email
    await this.sendInvitationEmail(invitation);
    
    // Log email sent
    await this.addHistoryEntry(invitation.id, {
      timestamp: Timestamp.now(),
      action: 'sent',
      performedBy: params.createdBy,
      details: `Invitation email sent to ${invitation.email}`
    });
    
    await AuditLogger.log({
      action: 'invitation_sent',
      userId: params.createdBy,
      targetType: 'invitation',
      targetId: invitation.id,
      details: {
        email: invitation.email,
        method: 'email'
      }
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
      
      // Log successful acceptance
      await AuditLogger.log({
        action: 'invitation_accepted',
        userId: userUID,
        targetType: 'invitation',
        targetId: invitation.id,
        details: {
          email: invitation.email,
          role: invitation.role,
          organizationId: invitation.organizationId
        }
      });
      
      return { success: true, user };
      
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: 'Failed to accept invitation' };
    }
  }
  
  /**
   * Validate invitation status and expiry
   */
  private async validateInvitation(invitation: Invitation): Promise<ValidationResult> {
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
    
    // Log user creation
    await AuditLogger.log({
      action: 'user_registered',
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
  
  /**
   * Send invitation email using real email service
   */
  private async sendInvitationEmail(invitation: Invitation): Promise<void> {
    try {
      const inviterName = await this.getInviterName(invitation.createdBy);
      const organizationName = await this.getOrganizationName(invitation.organizationId);
      
      const result = await EmailService.sendInvitationEmail(
        invitation.email,
        invitation.invitationCode,
        invitation.role,
        organizationName,
        inviterName,
        invitation.metadata.welcomeMessage
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invitation email');
      }
      
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw error;
    }
  }
  
  /**
   * Get invitation template for organization and role
   */
  private async getInvitationTemplate(
    organizationId: string, 
    role: string
  ): Promise<InvitationTemplate> {
    // Try to get organization-specific template
    const template = await EmailTemplateService.getTemplateForRole(
      organizationId, 
      role as 'coach' | 'parent'
    );
    
    if (template) {
      return template;
    }
    
    // Fall back to default template
    return this.getDefaultTemplate(role);
  }
  
  /**
   * Get default email template for role
   */
  private getDefaultTemplate(role: string): InvitationTemplate {
    const defaultTemplate = EmailTemplateService.getDefaultTemplate(role as 'coach' | 'parent');
    
    return {
      id: 'default',
      organizationId: 'default',
      name: `תבנית ברירת מחדל - ${role}`,
      role: role as 'coach' | 'parent',
      subject: defaultTemplate.subject,
      bodyTemplate: defaultTemplate.bodyTemplate,
      createdAt: Timestamp.now(),
      createdBy: 'system',
      isDefault: true,
      isActive: true
    };
  }
  
  /**
   * Populate template with data
   */
  private async populateTemplate(
    template: InvitationTemplate, 
    data: Record<string, string>
  ): Promise<{ subject: string; body: string }> {
    let subject = template.subject;
    let body = template.bodyTemplate;
    
    // Simple template replacement (in real implementation, use a proper template engine)
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }
    
    // Handle conditional blocks (basic implementation)
    body = body.replace(/{{#if customMessage}}(.*?){{\/if}}/gs, (match, content) => {
      return data.customMessage ? content : '';
    });
    
    return { subject, body };
  }
  
  // Helper methods
  
  async getInvitationByCode(code: string): Promise<Invitation | null> {
    const q = query(
      collection(db, 'invitations'),
      where('invitationCode', '==', code)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data() as Invitation;
  }
  
  async markInvitationAccepted(id: string, userUID: string): Promise<void> {
    await updateDoc(doc(db, 'invitations', id), {
      status: 'accepted',
      acceptedAt: Timestamp.now(),
      acceptedBy: userUID,
      history: arrayUnion({
        timestamp: Timestamp.now(),
        action: 'accepted',
        performedBy: userUID,
        details: 'User completed registration'
      })
    });
  }
  
  async markInvitationExpired(id: string): Promise<void> {
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
      action: 'invitation_expired',
      userId: 'system',
      targetType: 'invitation',
      targetId: id,
      details: {
        reason: 'automatic_expiry'
      }
    });
  }
  
  async addHistoryEntry(id: string, entry: InvitationHistoryEntry): Promise<void> {
    await updateDoc(doc(db, 'invitations', id), {
      history: arrayUnion(entry)
    });
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    const q = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data() as User;
  }
  
  private async addParentToBabyProfile(babyProfileId: string, parentId: string): Promise<void> {
    const babyRef = doc(db, 'baby_profiles', babyProfileId);
    await updateDoc(babyRef, {
      parentIds: arrayUnion(parentId),
      lastUpdatedAt: Timestamp.now()
    });
    
    await AuditLogger.log({
      action: 'parent_added_to_baby',
      userId: parentId,
      targetType: 'baby_profile',
      targetId: babyProfileId,
      details: {
        parentId,
        method: 'invitation_acceptance'
      }
    });
  }
  
  private async initializeCoachWorkspace(user: User): Promise<void> {
    // Initialize coach-specific data and settings
    console.log('Initializing coach workspace for:', user.uid);
  }
  
  private async initializeAdminPermissions(user: User): Promise<void> {
    // Set up admin-specific permissions and access
    console.log('Initializing admin permissions for:', user.uid);
  }
  
  private async getInviterName(inviterId: string): Promise<string> {
    const userDoc = await getDoc(doc(db, 'users', inviterId));
    if (userDoc.exists()) {
      const user = userDoc.data() as User;
      return user.displayName || user.email || 'Team Member';
    }
    return 'Team Member';
  }
  
  private async getOrganizationName(organizationId: string): Promise<string> {
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (orgDoc.exists()) {
      const org = orgDoc.data();
      return org.name || 'Laila Tov';
    }
    return 'Laila Tov';
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(invitationId: string, userId: string): Promise<void> {
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    
    if (!invitationDoc.exists()) {
      throw new Error('Invitation not found');
    }
    
    const invitation = invitationDoc.data() as Invitation;
    
    // Validate invitation can be resent
    if (invitation.status !== 'pending') {
      throw new Error('Invitation cannot be resent - not in pending status');
    }
    
    if (invitation.expiresAt.toDate() < new Date()) {
      throw new Error('Invitation has expired');
    }
    
    // Send email
    await this.sendInvitationEmail(invitation);
    
    // Add history entry
    await this.addHistoryEntry(invitationId, {
      timestamp: Timestamp.now(),
      action: 'reminded',
      performedBy: userId,
      details: 'Invitation email resent'
    });
    
    // Log audit event
    await AuditLogger.log({
      action: 'invitation_resent',
      userId: userId,
      targetType: 'invitation',
      targetId: invitationId,
      details: {
        email: invitation.email
      }
    });
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'cancelled',
      history: arrayUnion({
        timestamp: Timestamp.now(),
        action: 'cancelled',
        performedBy: userId,
        details: 'Invitation cancelled by user'
      })
    });
    
    await AuditLogger.log({
      action: 'invitation_cancelled',
      userId: userId,
      targetType: 'invitation',
      targetId: invitationId,
      details: {
        reason: 'manual_cancellation'
      }
    });
  }
}

