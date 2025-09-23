// Cloud Functions Type Definitions (copied from main app)
import type { Timestamp } from 'firebase-admin/firestore';

export interface User {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  role: 'admin' | 'coach' | 'parent';
  organizationId: string;
  permissions: string[];
  status: 'active' | 'suspended' | 'inactive';
  assignedCoachId?: string;
  managedBabyProfiles: string[];
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  invitationAcceptedAt: Timestamp;
  originalInvitationId: string;
  preferences: {
    language: 'he' | 'en';
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      reminders: boolean;
    };
  };
}

export interface Invitation {
  id: string;
  invitationCode: string;
  email: string;
  role: 'admin' | 'coach' | 'parent';
  organizationId: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  createdBy: string;
  acceptedBy?: string;
  metadata: {
    babyProfileId?: string;
    assignedCoachId?: string;
    permissions?: string[];
    maxBabyProfiles?: number;
    welcomeMessage?: string;
    customInstructions?: string;
  };
  history: InvitationHistoryEntry[];
}

export interface InvitationHistoryEntry {
  timestamp: Timestamp;
  action: 'created' | 'sent' | 'reminded' | 'accepted' | 'expired' | 'cancelled';
  performedBy: string;
  details?: string;
  ipAddress?: string;
}

export interface CreateInvitationParams {
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

export type AuditAction = 
  | 'user_login' | 'user_logout' | 'user_login_failed' | 'user_registered' | 'user_deactivated'
  | 'password_changed' | 'password_reset_requested' | 'password_reset_completed'
  | 'invitation_created' | 'invitation_sent' | 'invitation_accepted' | 'invitation_expired'
  | 'invitation_cancelled' | 'invitation_resent'
  | 'role_created' | 'role_updated' | 'role_deleted' | 'role_assigned' | 'role_unassigned'
  | 'permission_granted' | 'permission_revoked'
  | 'baby_profile_created' | 'baby_profile_updated' | 'baby_profile_archived'
  | 'baby_profile_transferred' | 'baby_profile_restored'
  | 'parent_added_to_baby' | 'parent_removed_from_baby'
  | 'sleep_log_created' | 'sleep_log_updated' | 'sleep_log_deleted'
  | 'sleep_data_exported' | 'sleep_data_imported'
  | 'recommendation_created' | 'recommendation_updated' | 'recommendation_viewed'
  | 'consultation_note_added'
  | 'report_generated' | 'report_exported' | 'report_shared'
  | 'dashboard_viewed' | 'analytics_accessed'
  | 'organization_settings_updated' | 'system_backup_created'
  | 'data_migration_started' | 'data_migration_completed'
  | 'security_incident_detected' | 'suspicious_activity_blocked'
  | 'data_accessed' | 'unauthorized_access_attempt' | 'data_download_requested'
  | 'bulk_data_operation' | 'sensitive_data_viewed';


