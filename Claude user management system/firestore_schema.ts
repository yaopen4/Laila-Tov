// Firestore Collections Schema for Laila Tov

// 1. INVITATIONS COLLECTION
interface Invitation {
  // Primary identifiers
  id: string; // Auto-generated document ID
  invitationCode: string; // 8-character unique code (e.g., "AB12CD34")
  email: string; // Invitee's email address
  
  // Role and access management
  role: 'admin' | 'coach' | 'parent';
  organizationId: string; // For multi-tenant isolation
  
  // State management
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  
  // Metadata
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp; // 7 days from creation
  acceptedAt?: FirebaseFirestore.Timestamp;
  
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

interface InvitationHistoryEntry {
  timestamp: FirebaseFirestore.Timestamp;
  action: 'created' | 'sent' | 'reminded' | 'accepted' | 'expired' | 'cancelled';
  performedBy: string; // UID
  details?: string;
  ipAddress?: string;
}

// 2. USERS COLLECTION (Enhanced)
interface User {
  // Firebase Auth fields
  uid: string; // Firebase Auth UID
  email: string;
  emailVerified: boolean;
  
  // Profile information
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  
  // Role and access
  role: 'admin' | 'coach' | 'parent';
  organizationId: string;
  permissions: string[];
  
  // Status management
  status: 'active' | 'suspended' | 'inactive';
  
  // Relationships
  assignedCoachId?: string; // For parents
  managedBabyProfiles: string[]; // Array of baby profile IDs
  
  // Metadata
  createdAt: FirebaseFirestore.Timestamp;
  lastLoginAt: FirebaseFirestore.Timestamp;
  invitationAcceptedAt: FirebaseFirestore.Timestamp;
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

// 3. BABY_PROFILES COLLECTION (Enhanced)
interface BabyProfile {
  id: string;
  
  // Basic information
  name: string;
  dateOfBirth: FirebaseFirestore.Timestamp;
  gender?: 'male' | 'female' | 'other';
  
  // Access control
  organizationId: string;
  assignedCoachId: string;
  parentIds: string[]; // Array of parent UIDs
  
  // Status
  status: 'active' | 'archived' | 'transferred';
  
  // Metadata
  createdAt: FirebaseFirestore.Timestamp;
  createdBy: string; // Coach UID
  lastUpdatedAt: FirebaseFirestore.Timestamp;
  
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
}

// 4. ORGANIZATIONS COLLECTION (New)
interface Organization {
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
  createdAt: FirebaseFirestore.Timestamp;
  ownerId: string; // Admin UID
  isActive: boolean;
}

// 5. INVITATION_TEMPLATES COLLECTION (New)
interface InvitationTemplate {
  id: string;
  organizationId: string;
  name: string;
  role: 'coach' | 'parent';
  
  // Template content
  subject: string;
  bodyTemplate: string; // HTML with placeholders
  
  // Metadata
  createdAt: FirebaseFirestore.Timestamp;
  createdBy: string;
  isDefault: boolean;
  isActive: boolean;
}