// functions/src/index.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext } from 'firebase-functions/v1/https';

admin.initializeApp();

/**
 * Cloud Function to handle user registration after invitation acceptance
 */
export const processUserRegistration = functions.auth.user().onCreate(async (user) => {
  try {
    // This runs when a new Firebase Auth user is created
    // We need to link them with their invitation
    
    const email = user.email?.toLowerCase();
    if (!email) return;
    
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
        'history': admin.firestore.FieldValue.arrayUnion({
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
      'history': admin.firestore.FieldValue.arrayUnion({
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
    
    console.log(`User registration completed for ${email} with role ${invitation.role}`);
    
  } catch (error) {
    console.error('Error processing user registration:', error);
    // Don't throw - we don't want to prevent user creation
  }
});

/**
 * Callable function to create new invitations
 */
export const createInvitation = functions.https.onCall(
  async (data: CreateInvitationRequest, context: CallableContext) => {
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
        'history': admin.firestore.FieldValue.arrayUnion({
          timestamp: admin.firestore.Timestamp.now(),
          action: 'sent',
          performedBy: callerUID,
          details: `Invitation email sent to ${data.email}`
        })
      });
      
      return {
        success: true,
        invitationId: invitationRef.id,
        invitationCode: invitationCode
      };
      
    } catch (error) {
      console.error('Error creating invitation:', error);
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
  .onRun(async (context) => {
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
    
    expiredQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'expired',
        'history': admin.firestore.FieldValue.arrayUnion({
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
    } else {
      console.log('No expired invitations found');
    }
    
    return null;
  });

/**
 * Callable function to resend invitation email
 */
export const resendInvitation = functions.https.onCall(
  async (data: { invitationId: string }, context: CallableContext) => {
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
        'history': admin.firestore.FieldValue.arrayUnion({
          timestamp: admin.firestore.Timestamp.now(),
          action: 'reminded',
          performedBy: callerUID,
          details: 'Invitation email resent'
        })
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Error resending invitation:', error);
      throw new functions.https.HttpsError('internal', 'Failed to resend invitation');
    }
  }
);

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
function getDefaultPermissions(role: string): string[] {
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
      }
      break;
      
    case 'coach':
      // Initialize coach-specific collections or settings if needed
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
  // Get organization details
  const orgDoc = await admin.firestore()
    .collection('organizations')
    .doc(invitation.organizationId)
    .get();
  
  const organization = orgDoc.data();
  const orgName = organization?.name || 'Laila Tov';
  
  // Get inviter details
  const inviterDoc = await admin.firestore()
    .collection('users')
    .doc(invitation.createdBy)
    .get();
  
  const inviter = inviterDoc.data();
  const inviterName = inviter?.displayName || 'Team Member';
  
  // Email template based on role
  const templates = {
    parent: {
      subject: `הזמנה להצטרפות למערכת ${orgName} לניהול שינה`,
      body: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>שלום,</h2>
          <p>הוזמנת על ידי ${inviterName} להצטרף למערכת ${orgName} לניהול שינה של התינוק שלך.</p>
          <p><strong>קוד ההזמנה שלך: ${invitation.invitationCode}</strong></p>
          <p>להשלמת הרשמה, היכנס לאתר ושים את קוד ההזמנה.</p>
          <p>הזמנה זו תפוג ב: ${invitation.expiresAt.toDate().toLocaleDateString('he-IL')}</p>
          <a href="${process.env.APP_URL}/register?code=${invitation.invitationCode}" 
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
          <a href="${process.env.APP_URL}/register?code=${invitation.invitationCode}" 
             style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            הצטרף עכשיו
          </a>
        </div>
      `
    }
  };
  
  const template = templates[invitation.role] || templates.parent;
  
  // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
  // For example using SendGrid:
  
  /*
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(functions.config().sendgrid.key);
  
  const msg = {
    to: invitation.email,
    from: 'noreply@lailatov.com',
    subject: template.subject,
    html: template.body,
  };
  
  await sgMail.send(msg);
  */
  
  console.log(`Email would be sent to ${invitation.email} with code ${invitation.invitationCode}`);
}

// Type definitions
interface CreateInvitationRequest {
  email: string;
  role: 'admin' | 'coach' | 'parent';
  organizationId: string;
  metadata?: {
    babyProfileId?: string;
    assignedCoachId?: string;
    permissions?: string[];
    welcomeMessage?: string;
  };
}