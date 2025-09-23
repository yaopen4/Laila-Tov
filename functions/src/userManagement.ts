// Cloud Functions for User Management
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// Using ambient types declared in src/types/app-types.d.ts

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function to handle user registration after invitation acceptance
 */
export const processUserRegistration = functions.auth.user().onCreate(async (user: any) => {
  try {
    const email = user.email?.toLowerCase();
    if (!email) return;
    
    console.log(`Processing registration for user: ${email}`);
    
    // Find pending invitation for this email
    const invitationsRef = admin.firestore().collection('invitations');
    const invitationQuery = await invitationsRef
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    if (invitationQuery.empty) {
      console.log(`No pending invitation found for email: ${email}`);
      return;
    }
    
    const invitationDoc = invitationQuery.docs[0];
    const invitation = invitationDoc.data() as Invitation;
    
    // Validate invitation hasn't expired
    if (invitation.expiresAt.toDate() < new Date()) {
      await invitationDoc.ref.update({
        status: 'expired',
        history: admin.firestore.FieldValue.arrayUnion({
          timestamp: admin.firestore.Timestamp.now(),
          action: 'expired',
          performedBy: 'system',
          details: 'Invitation expired during user registration'
        })
      });
      return;
    }
    
    // Create user document with invitation data
    const userData: User = {
      uid: user.uid,
      email: email,
      emailVerified: user.emailVerified,
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || undefined,
      photoURL: user.photoURL || undefined,
      role: invitation.role,
      organizationId: invitation.organizationId,
      permissions: getDefaultPermissions(invitation.role),
      status: 'active',
      assignedCoachId: invitation.metadata.assignedCoachId,
      managedBabyProfiles: invitation.metadata.babyProfileId ? 
        [invitation.metadata.babyProfileId] : [],
      createdAt: admin.firestore.Timestamp.now(),
      lastLoginAt: admin.firestore.Timestamp.now(),
      invitationAcceptedAt: admin.firestore.Timestamp.now(),
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
    
    // Save user document
    await admin.firestore().collection('users').doc(user.uid).set(userData);
    
    // Update invitation status
    await invitationDoc.ref.update({
      status: 'accepted',
      acceptedAt: admin.firestore.Timestamp.now(),
      acceptedBy: user.uid,
      history: admin.firestore.FieldValue.arrayUnion({
        timestamp: admin.firestore.Timestamp.now(),
        action: 'accepted',
        performedBy: user.uid,
        details: 'User completed registration'
      })
    });
    
    // Set custom claims for role-based access
    await admin.auth().setCustomUserClaims(user.uid, {
      role: invitation.role,
      organizationId: invitation.organizationId,
      permissions: userData.permissions
    });
    
    // Perform role-specific setup
    await performRoleSpecificSetup(invitation, userData);
    
    // Log audit event
    await logAuditEvent({
      action: 'user_registered',
      userId: user.uid,
      targetType: 'user',
      targetId: user.uid,
      organizationId: invitation.organizationId,
      details: {
        email: userData.email,
        role: userData.role,
        invitationId: invitation.id
      },
      success: true
    });
    
    console.log(`User registration completed for ${email} with role ${invitation.role}`);
    
  } catch (error) {
    console.error('Error processing user registration:', error);
    
    // Log failed registration
    if (user.email) {
      await logAuditEvent({
        action: 'user_registered',
        userId: user.uid,
        targetType: 'user',
        targetId: user.uid,
        organizationId: 'unknown',
        details: {
          email: user.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * Callable function to create invitations
 */
export const createInvitation = functions.https.onCall(
  async (data: CreateInvitationParams, context: any) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    
    const callerUID = context.auth.uid;
    const callerRole = context.auth.token.role;
    const callerOrgId = context.auth.token.organizationId;
    
    // Validate permissions
    if (callerRole !== 'admin' && !(callerRole === 'coach' && data.role === 'parent')) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'Insufficient permissions to create invitation'
      );
    }
    
    // Validate input
    if (!data.email || !data.role || !data.organizationId) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Missing required fields'
      );
    }
    
    // Ensure organization matches
    if (data.organizationId !== callerOrgId) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'Cannot create invitation for different organization'
      );
    }
    
    try {
      // Check if user already exists
      const existingUsers = await admin.firestore()
        .collection('users')
        .where('email', '==', data.email.toLowerCase())
        .limit(1)
        .get();
      
      if (!existingUsers.empty) {
        throw new functions.https.HttpsError(
          'already-exists', 
          'User with this email already exists'
        );
      }
      
      // Check for existing pending invitation
      const existingInvitations = await admin.firestore()
        .collection('invitations')
        .where('email', '==', data.email.toLowerCase())
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      
      if (!existingInvitations.empty) {
        throw new functions.https.HttpsError(
          'already-exists', 
          'Pending invitation already exists for this email'
        );
      }
      
      // Generate unique invitation code
      const invitationCode = await generateUniqueInvitationCode();
      
      // Create invitation document
      const invitationRef = admin.firestore().collection('invitations').doc();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      
      const invitationData: Invitation = {
        id: invitationRef.id,
        invitationCode,
        email: data.email.toLowerCase().trim(),
        role: data.role,
        organizationId: data.organizationId,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdBy: callerUID,
        metadata: data.metadata || {},
        history: [{
          timestamp: admin.firestore.Timestamp.now(),
          action: 'created',
          performedBy: callerUID,
          details: `Invitation created for ${data.role} role`
        }]
      };
      
      await invitationRef.set(invitationData);
      
      // Send invitation email
      await sendInvitationEmail(invitationData);
      
      // Log email sent
      await invitationRef.update({
        history: admin.firestore.FieldValue.arrayUnion({
          timestamp: admin.firestore.Timestamp.now(),
          action: 'sent',
          performedBy: callerUID,
          details: `Invitation email sent to ${data.email}`
        })
      });
      
      // Log audit events
      await logAuditEvent({
        action: 'invitation_created',
        userId: callerUID,
        targetType: 'invitation',
        targetId: invitationRef.id,
        organizationId: data.organizationId,
        details: {
          email: data.email,
          role: data.role
        },
        success: true
      });
      
      await logAuditEvent({
        action: 'invitation_sent',
        userId: callerUID,
        targetType: 'invitation',
        targetId: invitationRef.id,
        organizationId: data.organizationId,
        details: {
          email: data.email,
          method: 'email'
        },
        success: true
      });
      
      return {
        success: true,
        invitationId: invitationRef.id,
        invitationCode: invitationCode
      };
      
    } catch (error) {
      console.error('Error creating invitation:', error);
      
      // Log failed invitation creation
      await logAuditEvent({
        action: 'invitation_created',
        userId: callerUID,
        targetType: 'invitation',
        targetId: 'unknown',
        organizationId: data.organizationId,
        details: {
          email: data.email,
          role: data.role,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to create invitation');
    }
  }
);

/**
 * Scheduled function to clean up expired invitations
 */
export const cleanupExpiredInvitations = functions.pubsub
  .schedule('0 2 * * *') // Run daily at 2 AM
  .timeZone('Asia/Jerusalem')
  .onRun(async () => {
    console.log('Starting expired invitations cleanup');
    
    const now = admin.firestore.Timestamp.now();
    const invitationsRef = admin.firestore().collection('invitations');
    
    // Find expired invitations that are still pending
    const expiredQuery = await invitationsRef
      .where('status', '==', 'pending')
      .where('expiresAt', '<=', now)
      .get();
    
    const batch = admin.firestore().batch();
    let expiredCount = 0;
    
    expiredQuery.docs.forEach((doc: any) => {
      batch.update(doc.ref, {
        status: 'expired',
        history: admin.firestore.FieldValue.arrayUnion({
          timestamp: now,
          action: 'expired',
          performedBy: 'system',
          details: 'Automatically expired by cleanup job'
        })
      });
      expiredCount++;
    });
    
    if (expiredCount > 0) {
      await batch.commit();
      console.log(`Marked ${expiredCount} invitations as expired`);
      
      // Log cleanup audit event
      await logAuditEvent({
        action: 'invitation_expired',
        userId: 'system',
        targetType: 'invitation',
        targetId: 'bulk',
        organizationId: 'system',
        details: {
          count: expiredCount,
          reason: 'scheduled_cleanup'
        },
        success: true
      });
    } else {
      console.log('No expired invitations found');
    }
    
    return null;
  });

/**
 * Callable function to resend invitation email
 */
export const resendInvitation = functions.https.onCall(
  async (data: { invitationId: string }, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    
    const callerUID = context.auth.uid;
    const callerRole = context.auth.token.role;
    
    try {
      const invitationDoc = await admin.firestore()
        .collection('invitations')
        .doc(data.invitationId)
        .get();
      
      if (!invitationDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Invitation not found');
      }
      
      const invitation = invitationDoc.data() as Invitation;
      
      // Check permissions
      if (invitation.createdBy !== callerUID && callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Cannot resend this invitation');
      }
      
      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation is not pending');
      }
      
      if (invitation.expiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation has expired');
      }
      
      // Resend email
      await sendInvitationEmail(invitation);
      
      // Log resend action
      await invitationDoc.ref.update({
        history: admin.firestore.FieldValue.arrayUnion({
          timestamp: admin.firestore.Timestamp.now(),
          action: 'reminded',
          performedBy: callerUID,
          details: 'Invitation email resent'
        })
      });
      
      // Log audit event
      await logAuditEvent({
        action: 'invitation_resent',
        userId: callerUID,
        targetType: 'invitation',
        targetId: data.invitationId,
        organizationId: invitation.organizationId,
        details: {
          email: invitation.email
        },
        success: true
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Error resending invitation:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to resend invitation');
    }
  }
);

// Helper Functions

/**
 * Helper function to generate unique invitation code
 */
async function generateUniqueInvitationCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const existingInvitation = await admin.firestore()
      .collection('invitations')
      .where('invitationCode', '==', code)
      .where('status', '!=', 'expired')
      .limit(1)
      .get();
    
    if (existingInvitation.empty) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Unable to generate unique invitation code');
}

/**
 * Helper function to get default permissions
 */
function getDefaultPermissions(role: Invitation['role']): string[] {
  const permissions: Record<Invitation['role'], string[]> = {
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
 * Helper function for role-specific setup
 */
async function performRoleSpecificSetup(
  invitation: Invitation, 
  userData: User
): Promise<void> {
  switch (invitation.role) {
    case 'parent':
      if (invitation.metadata.babyProfileId) {
        // Add parent to baby profile
        await admin.firestore()
          .collection('baby_profiles')
          .doc(invitation.metadata.babyProfileId)
          .update({
            parentIds: admin.firestore.FieldValue.arrayUnion(userData.uid),
            lastUpdatedAt: admin.firestore.Timestamp.now()
          });
        
        await logAuditEvent({
          action: 'parent_added_to_baby',
          userId: userData.uid,
          targetType: 'baby_profile',
          targetId: invitation.metadata.babyProfileId,
          organizationId: invitation.organizationId,
          details: {
            parentId: userData.uid,
            method: 'invitation_acceptance'
          },
          success: true
        });
      }
      break;
      
    case 'coach':
      // Initialize coach-specific collections or settings if needed
      await admin.firestore()
        .collection('coaches')
        .doc(userData.uid)
        .set({
          id: userData.uid,
          clientCount: 0,
          createdAt: admin.firestore.Timestamp.now()
        });
      break;
      
    case 'admin':
      // Set up admin-specific permissions or data
      break;
  }
}

/**
 * Helper function to send invitation emails
 */
async function sendInvitationEmail(invitation: Invitation): Promise<void> {
  try {
    // Get organization details
    const orgDoc = await admin.firestore()
      .collection('organizations')
      .doc(invitation.organizationId)
      .get();
    
    const organization = orgDoc.exists ? orgDoc.data() : null;
    const orgName = organization?.name || 'Laila Tov';
    
    // Get inviter details
    const inviterDoc = await admin.firestore()
      .collection('users')
      .doc(invitation.createdBy)
      .get();
    
    const inviter = inviterDoc.exists ? inviterDoc.data() : null;
    const inviterName = inviter?.displayName || inviter?.email || 'Team Member';
    
    // Email template based on role
    const templates: Record<Invitation['role'], { subject: string; body: string }> = {
      parent: {
        subject: `הזמנה להצטרפות למערכת ${orgName} לניהול שינה`,
        body: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>שלום,</h2>
            <p>הוזמנת על ידי ${inviterName} להצטרף למערכת ${orgName} לניהול שינה של התינוק שלך.</p>
            <p><strong>קוד ההזמנה שלך: ${invitation.invitationCode}</strong></p>
            <p>להשלמת הרשמה, היכנס לאתר ושים את קוד ההזמנה.</p>
            <p>הזמנה זו תפוג ב: ${invitation.expiresAt.toDate().toLocaleDateString('he-IL')}</p>
            <a href="${process.env.APP_URL}/signup?code=${invitation.invitationCode}" 
               style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              הצטרף עכשיו
            </a>
          </div>
        `
      },
      coach: {
        subject: `הזמנה להצטרפות כיועץ שינה ב${orgName}`,
        body: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>שלום,</h2>
            <p>הוזמנת להצטרף כיועץ שינה במערכת ${orgName}.</p>
            <p><strong>קוד ההזמנה שלך: ${invitation.invitationCode}</strong></p>
            <p>להשלמת הרשמה, היכנס לאתר ושים את קוד ההזמנה.</p>
            <a href="${process.env.APP_URL}/signup?code=${invitation.invitationCode}" 
               style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              הצטרף עכשיו
            </a>
          </div>
        `
      },
      admin: {
        subject: `הזמנה לניהול מערכת ${orgName}`,
        body: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>שלום,</h2>
            <p>הוזמנת להצטרף כמנהל מערכת ב${orgName}.</p>
            <p><strong>קוד ההזמנה שלך: ${invitation.invitationCode}</strong></p>
            <p>להשלמת הרשמה, היכנס לאתר ושים את קוד ההזמנה.</p>
            <a href="${process.env.APP_URL}/signup?code=${invitation.invitationCode}" 
               style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              הצטרף עכשיו
            </a>
          </div>
        `
      }
    };
    
    const template = templates[invitation.role] || templates.parent;
    
    // Use proper email service
    const emailResult = await sendEmailWithService({
      to: invitation.email,
      subject: template.subject,
      html: template.body
    });
    
    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }
    
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

/**
 * Email service for Cloud Functions
 */
async function sendEmailWithService(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Check if we have SendGrid configured
    const sendgridKey = functions.config().sendgrid?.key;
    
    if (sendgridKey) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(sendgridKey);
      
      const msg = {
        to: params.to,
        from: 'noreply@lailatov.com',
        subject: params.subject,
        html: params.html,
      };
      
      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id']
      };
    } else {
      // Development mode - log email
      console.log('\n📧 EMAIL (Cloud Functions):');
      console.log('To:', params.to);
      console.log('Subject:', params.subject);
      console.log('HTML:', params.html.substring(0, 200) + '...');
      console.log('✅ Email would be sent in production with proper SendGrid config\n');
      
      return {
        success: true,
        messageId: `dev-${Date.now()}`
      };
    }
    
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error'
    };
  }
}

/**
 * Helper function to log audit events
 */
async function logAuditEvent(params: {
  action: AuditAction;
  userId: string;
  targetType?: string;
  targetId?: string;
  organizationId: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    // Get user details for better audit logging
    let userEmail = 'system';
    let userRole = 'system';
    
    if (params.userId !== 'system') {
      try {
        const userDoc = await admin.firestore().collection('users').doc(params.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userEmail = userData?.email || 'unknown';
          userRole = userData?.role || 'unknown';
        }
      } catch (error) {
        console.warn('Could not fetch user details for audit log:', error);
      }
    }
    
    const auditEntry = {
      id: admin.firestore().collection('audit_logs').doc().id,
      timestamp: admin.firestore.Timestamp.now(),
      userId: params.userId,
      userEmail,
      userRole,
      organizationId: params.organizationId,
      action: params.action,
      category: categorizeAction(params.action),
      severity: determineSeverity(params.action, params.success),
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details,
      success: params.success,
      errorMessage: params.errorMessage
    };
    
    // Choose appropriate collection based on sensitivity
    const collectionName = auditEntry.category === 'security' || auditEntry.severity === 'critical' 
      ? 'audit_logs_security' 
      : 'audit_logs';
    
    await admin.firestore()
      .collection(collectionName)
      .doc(auditEntry.id)
      .set(auditEntry);
      
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

/**
 * Categorize audit actions
 */
function categorizeAction(action: AuditAction): string {
  const categoryMap: Record<string, string> = {
    user_login: 'authentication',
    user_logout: 'authentication',
    user_registered: 'user_management',
    invitation_created: 'user_management',
    invitation_sent: 'user_management',
    invitation_accepted: 'user_management',
    role_assigned: 'user_management',
    baby_profile_created: 'data_modification',
    unauthorized_access_attempt: 'security',
    security_incident_detected: 'security'
  };
  
  return categoryMap[action] || 'system_admin';
}

/**
 * Determine severity level
 */
function determineSeverity(action: AuditAction, success?: boolean): string {
  const criticalActions = ['security_incident_detected', 'unauthorized_access_attempt'];
  const highActions = ['user_registered', 'role_assigned'];
  const mediumActions = ['invitation_created', 'baby_profile_created'];
  
  if (criticalActions.includes(action)) return 'critical';
  if (highActions.includes(action)) return 'high';
  if (mediumActions.includes(action)) return 'medium';
  if (success === false) return 'medium';
  
  return 'low';
}



