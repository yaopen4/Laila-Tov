// User Management Types for Advanced RBAC System
import type { Timestamp } from 'firebase/firestore';
import type { SleepRecord } from './index';

// ============== PERMISSION SYSTEM ==============

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'user_management' | 'data_access' | 'baby_management' | 'system' | 'reporting';
  level: 'read' | 'write' | 'admin';
  dependencies?: string[]; // Required permissions
}

export interface RoleConstraints {
  maxBabyProfiles?: number;
  maxParentInvitations?: number;
  dataRetentionDays?: number;
  allowExport?: boolean;
  restrictedTimeAccess?: {
    startTime: string; // "09:00"
    endTime: string;   // "17:00"
    daysOfWeek: number[]; // [1,2,3,4,5] for weekdays
  };
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  organizationId: string;
  isSystemRole: boolean; // Cannot be modified
  isActive: boolean;
  permissions: string[]; // Permission IDs
  constraints?: RoleConstraints;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  organizationId: string;
  assignedBy: string;
  assignedAt: Timestamp;
  expiresAt?: Timestamp;
  isActive: boolean;
  context?: {
    babyProfileIds?: string[];
    departmentId?: string;
    territoryId?: string;
  };
}

// ============== USER SYSTEM ==============

export interface User {
  // Firebase Auth fields
  uid: string;
  email: string;
  emailVerified: boolean;
  
  // Profile information
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  
  // Role and access
  role: 'admin' | 'coach' | 'parent'; // Keep backward compatibility
  organizationId: string;
  permissions: string[];
  
  // Status management
  status: 'active' | 'suspended' | 'inactive';
  
  // Relationships
  assignedCoachId?: string; // For parents
  managedBabyProfiles: string[]; // Array of baby profile IDs
  
  // Metadata
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  invitationAcceptedAt: Timestamp;
  originalInvitationId: string;
  
  // Preferences
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

// ============== INVITATION SYSTEM ==============

export interface Invitation {
  // Primary identifiers
  id: string; // Auto-generated document ID
  invitationCode: string; // 8-character unique code
  email: string; // Invitee's email address
  
  // Role and access management
  role: 'admin' | 'coach' | 'parent';
  organizationId: string; // For multi-tenant isolation
  
  // State management
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  
  // Metadata
  createdAt: Timestamp;
  expiresAt: Timestamp; // 7 days from creation
  acceptedAt?: Timestamp;
  
  // Relationships
  createdBy: string; // UID of inviting user
  acceptedBy?: string; // UID of accepting user
  
  // Role-specific data
  metadata: {
    // For parent invitations
    babyProfileId?: string;
    assignedCoachId?: string;
    
    // For coach invitations
    permissions?: string[];
    maxBabyProfiles?: number;
    
    // Common
    welcomeMessage?: string;
    customInstructions?: string;
  };
  
  // Audit trail
  history: InvitationHistoryEntry[];
}

export interface InvitationHistoryEntry {
  timestamp: Timestamp;
  action: 'created' | 'sent' | 'reminded' | 'accepted' | 'expired' | 'cancelled';
  performedBy: string; // UID
  details?: string;
  ipAddress?: string;
}

// ============== ORGANIZATION SYSTEM ==============

export interface Organization {
  id: string;
  name: string;
  type: 'clinic' | 'independent' | 'enterprise';
  
  // Settings
  settings: {
    defaultInvitationExpiry: number; // days
    maxCoaches: number;
    maxBabyProfilesPerCoach: number;
    allowParentInvitations: boolean;
  };
  
  // Branding
  branding?: {
    logoURL?: string;
    primaryColor?: string;
    customDomain?: string;
  };
  
  // Metadata
  createdAt: Timestamp;
  ownerId: string; // Admin UID
  isActive: boolean;
}

// ============== BABY PROFILES ==============

export interface BabyProfile {
  id: string;
  
  // Basic information
  name: string;
  dateOfBirth: Timestamp;
  gender?: 'male' | 'female' | 'other';
  
  // Access control
  organizationId: string;
  assignedCoachId: string;
  parentIds: string[]; // Array of parent UIDs
  
  // Status
  status: 'active' | 'archived' | 'transferred';
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string; // Coach UID
  lastUpdatedAt: Timestamp;
  
  // Sleep tracking configuration
  settings: {
    sleepGoals: {
      nightSleepHours: number;
      dayNaps: number;
      totalSleepHours: number;
    };
    trackingPreferences: {
      reminderTime?: string;
      autoArchiveAfterDays?: number;
    };
  };
  
  // Legacy fields for backward compatibility
  familyName: string;
  age: number;
  motherName: string;
  fatherName: string;
  siblingsCount: number;
  siblingsNames?: string;
  description?: string;
  parentUsername: string;
  coachNotes?: string;
  isArchived: boolean;
  dateArchived?: string | null;
  lastModified: string;
  inviteCode: string;

  /** Hydrated separately by callers that need recent sleep data (e.g. baby cards). */
  sleepRecords?: SleepRecord[];
  /** Parent addresses captured on the create form, for redisplay when editing. */
  parentEmails?: string[];
}

// ============== AUDIT SYSTEM ==============

export interface AuditLogEntry {
  id: string;
  timestamp: Timestamp;
  
  // Actor information
  userId: string;
  userEmail: string;
  userRole: string;
  organizationId: string;
  
  // Action details
  action: AuditAction;
  category: AuditCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Target information
  targetType?: 'user' | 'baby_profile' | 'sleep_log' | 'role' | 'organization' | 'invitation' | 'report';
  targetId?: string;
  targetUserId?: string; // If action affects another user
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  // Additional details (structured data)
  details: Record<string, any>;
  
  // Success/failure tracking
  success: boolean;
  errorMessage?: string;
  
  // Data changes (for update operations)
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export type AuditAction = 
  // Authentication & User Management
  | 'user_login' | 'user_logout' | 'user_login_failed' | 'user_registered' | 'user_deactivated'
  | 'password_changed' | 'password_reset_requested' | 'password_reset_completed'
  
  // Invitation Management
  | 'invitation_created' | 'invitation_sent' | 'invitation_accepted' | 'invitation_expired'
  | 'invitation_cancelled' | 'invitation_resent'
  
  // Role Management
  | 'role_created' | 'role_updated' | 'role_deleted' | 'role_assigned' | 'role_unassigned'
  | 'permission_granted' | 'permission_revoked'
  
  // Baby Profile Management
  | 'baby_profile_created' | 'baby_profile_updated' | 'baby_profile_archived'
  | 'baby_profile_transferred' | 'baby_profile_restored' | 'baby_profile_deleted'
  | 'parent_added_to_baby' | 'parent_removed_from_baby'
  
  // Sleep Data
  | 'sleep_log_created' | 'sleep_log_updated' | 'sleep_log_deleted'
  | 'sleep_data_exported' | 'sleep_data_imported'
  
  // Consultation & Recommendations
  | 'recommendation_created' | 'recommendation_updated' | 'recommendation_viewed'
  | 'consultation_note_added'
  
  // Reports & Analytics
  | 'report_generated' | 'report_exported' | 'report_shared'
  | 'dashboard_viewed' | 'analytics_accessed'
  
  // System Administration
  | 'organization_settings_updated' | 'system_backup_created' | 'system_bootstrapped'
  | 'data_migration_started' | 'data_migration_completed'
  | 'security_incident_detected' | 'suspicious_activity_blocked'
  
  // Data Access
  | 'data_accessed' | 'unauthorized_access_attempt' | 'data_download_requested'
  | 'bulk_data_operation' | 'sensitive_data_viewed';

export type AuditCategory = 
  | 'authentication' | 'user_management' | 'data_access' | 'data_modification'
  | 'system_admin' | 'security' | 'compliance' | 'performance';

// ============== INVITATION TEMPLATES ==============

export interface InvitationTemplate {
  id: string;
  organizationId: string;
  name: string;
  role: 'coach' | 'parent';
  
  // Template content
  subject: string;
  bodyTemplate: string; // HTML with placeholders
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  isDefault: boolean;
  isActive: boolean;
}

// ============== SERVICE INTERFACES ==============

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

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

// ============== REPORT INTERFACES ==============

export interface AuditReportSummary {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<string, number>;
  uniqueUsers: number;
  securityIncidents: number;
  failedAttempts: number;
  dataAccessCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface ComplianceReport {
  id: string;
  organizationId: string;
  generatedBy: string;
  generatedAt: Timestamp;
  reportType: 'security' | 'data_access' | 'user_activity' | 'full';
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };
  summary: AuditReportSummary;
  data: any[];
}

