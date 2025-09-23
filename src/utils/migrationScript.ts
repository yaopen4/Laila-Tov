// Migration Script: User Management standardization
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  Timestamp,
  writeBatch 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  User, 
  Invite, 
  Baby,
  Invitation, 
  BabyProfile,
  Organization 
} from '@/types';
import type { User as NewUser } from '@/types/auth';
import { RoleService } from '@/services/roleService';
import { AuditLogger } from '@/services/auditLogger';

interface MigrationResult {
  success: boolean;
  migratedUsers: number;
  migratedInvitations: number;
  migratedBabyProfiles: number;
  errors: string[];
  warnings: string[];
}

export class MigrationService {
  private errors: string[] = [];
  private warnings: string[] = [];
  
  /**
   * Main migration function - coordinates the entire migration process
   */
  async migrate(): Promise<MigrationResult> {
    console.log('Starting data migration for RBAC system...');
    
    try {
      // Step 1: Create default organization
      const defaultOrgId = await this.createDefaultOrganization();
      
      // Step 2: Initialize system roles
      await this.initializeSystemRoles(defaultOrgId);
      
      // Step 3: Migrate users
      const migratedUsers = await this.migrateUsers(defaultOrgId);
      
      // Step 4: Migrate invitations
      const migratedInvitations = await this.migrateInvitations(defaultOrgId);
      
      // Step 5: Migrate baby profiles
      const migratedBabyProfiles = await this.migrateBabyProfiles(defaultOrgId);
      
      // Step 6: Create role assignments for existing users
      await this.createRoleAssignments(defaultOrgId);
      
      // Step 7: Log migration completion
      await AuditLogger.log({
        action: 'data_migration_completed',
        userId: 'system',
        details: {
          migratedUsers,
          migratedInvitations,
          migratedBabyProfiles,
          organizationId: defaultOrgId
        }
      });
      
      console.log('Migration completed successfully!');
      
      return {
        success: true,
        migratedUsers,
        migratedInvitations,
        migratedBabyProfiles,
        errors: this.errors,
        warnings: this.warnings
      };
      
    } catch (error) {
      console.error('Migration failed:', error);
      this.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        migratedUsers: 0,
        migratedInvitations: 0,
        migratedBabyProfiles: 0,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }
  
  /**
   * Create default organization for existing data
   */
  private async createDefaultOrganization(): Promise<string> {
    console.log('Creating default organization...');
    
    const orgId = 'default-org';
    const organization: Organization = {
      id: orgId,
      name: 'Laila Tov - Default Organization',
      type: 'independent',
      settings: {
        defaultInvitationExpiry: 7,
        maxCoaches: 100,
        maxBabyProfilesPerCoach: 50,
        allowParentInvitations: true
      },
      branding: {
        logoURL: '',
        primaryColor: '#007bff',
        customDomain: ''
      },
      createdAt: Timestamp.now(),
      ownerId: 'system',
      isActive: true
    };
    
    await setDoc(doc(db, 'organizations', orgId), organization);
    
    await AuditLogger.log({
      action: 'organization_settings_updated',
      userId: 'system',
      targetType: 'organization',
      targetId: orgId,
      details: {
        name: organization.name,
        type: organization.type,
        reason: 'migration_default_org'
      }
    });
    
    return orgId;
  }
  
  /**
   * Initialize system roles for the organization
   */
  private async initializeSystemRoles(organizationId: string): Promise<void> {
    console.log('Initializing system roles...');
    
    await RoleService.initializeSystemRoles(organizationId, 'system');
  }
  
  /**
   * Migrate users to current schema
   */
  private async migrateUsers(organizationId: string): Promise<number> {
    console.log('Migrating users...');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let migratedCount = 0;
    
    const batch = writeBatch(db);
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const oldUser = userDoc.data() as User;
        
        // Create user record with current schema
        const enhancedUser: NewUser = {
          uid: oldUser.id,
          email: oldUser.email,
          emailVerified: true, // Assume verified for existing users
          displayName: oldUser.name,
          phoneNumber: undefined,
          photoURL: undefined,
          role: oldUser.role,
          organizationId: organizationId,
          permissions: this.getDefaultPermissions(oldUser.role),
          status: oldUser.status === 'disabled' ? 'inactive' : 'active',
          assignedCoachId: undefined, // Will be set based on baby profiles
          managedBabyProfiles: [],
          createdAt: Timestamp.now(),
          lastLoginAt: oldUser.lastLogin || Timestamp.now(),
          invitationAcceptedAt: Timestamp.now(),
          originalInvitationId: '', // Will be filled if invitation data exists
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
        
        // Update user document to current schema
        batch.set(doc(db, 'users', oldUser.id), enhancedUser);
        migratedCount++;
        
      } catch (error) {
        this.errors.push(`Failed to migrate user ${userDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    await batch.commit();
    
    console.log(`Migrated ${migratedCount} users`);
    return migratedCount;
  }
  
  /**
   * Migrate invitations to current schema
   */
  private async migrateInvitations(organizationId: string): Promise<number> {
    console.log('Migrating invitations...');
    
    const invitesSnapshot = await getDocs(collection(db, 'invites'));
    let migratedCount = 0;
    
    for (const inviteDoc of invitesSnapshot.docs) {
      try {
        const oldInvite = inviteDoc.data() as Invite;
        
        // Determine role from invite data
        const role = oldInvite.babyData ? 'parent' : 'coach';
        
        // Create invitation for each email in the old invite
        const emails = oldInvite.parentEmails || oldInvite.invitedEmails || [];
        
        for (const email of emails) {
          const enhancedInvitation: Invitation = {
            id: doc(collection(db, 'invitations')).id,
            invitationCode: this.generateInvitationCode(),
            email: email.toLowerCase(),
            role: role as any,
            organizationId: organizationId,
            status: this.mapInviteStatus(oldInvite.status),
            createdAt: oldInvite.createdAt,
            expiresAt: oldInvite.expiresAt,
            createdBy: oldInvite.coachId,
            metadata: {
              babyProfileId: oldInvite.babyData?.parentUsername,
              assignedCoachId: oldInvite.coachId,
              welcomeMessage: 'Migrated from old system'
            },
            history: [{
              timestamp: oldInvite.createdAt,
              action: 'created',
              performedBy: oldInvite.coachId,
              details: 'Migrated from old invitation system'
            }]
          };
          
          await setDoc(doc(db, 'invitations', enhancedInvitation.id), enhancedInvitation);
          migratedCount++;
        }
        
      } catch (error) {
        this.errors.push(`Failed to migrate invitation ${inviteDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`Migrated ${migratedCount} invitations`);
    return migratedCount;
  }
  
  /**
   * Migrate baby profiles to current schema
   */
  private async migrateBabyProfiles(organizationId: string): Promise<number> {
    console.log('Migrating baby profiles...');
    
    const babiesSnapshot = await getDocs(collection(db, 'babies'));
    let migratedCount = 0;
    
    for (const babyDoc of babiesSnapshot.docs) {
      try {
        const oldBaby = babyDoc.data() as Baby;
        
        const enhancedBabyProfile: BabyProfile = {
          id: oldBaby.id,
          name: oldBaby.name,
          dateOfBirth: Timestamp.fromDate(new Date()), // Approximate from age
          gender: undefined,
          organizationId: organizationId,
          assignedCoachId: oldBaby.coachId,
          parentIds: oldBaby.parentIds || [],
          status: oldBaby.isArchived ? 'archived' : 'active',
          createdAt: Timestamp.fromDate(new Date(oldBaby.lastModified)),
          createdBy: oldBaby.coachId,
          lastUpdatedAt: Timestamp.fromDate(new Date(oldBaby.lastModified)),
          settings: {
            sleepGoals: {
              nightSleepHours: 10,
              dayNaps: 2,
              totalSleepHours: 12
            },
            trackingPreferences: {
              reminderTime: '20:00',
              autoArchiveAfterDays: 30
            }
          },
          // Legacy fields for backward compatibility
          familyName: oldBaby.familyName,
          age: oldBaby.age,
          motherName: oldBaby.motherName,
          fatherName: oldBaby.fatherName,
          siblingsCount: oldBaby.siblingsCount,
          siblingsNames: oldBaby.siblingsNames,
          description: oldBaby.description,
          parentUsername: oldBaby.parentUsername,
          coachNotes: oldBaby.coachNotes,
          isArchived: oldBaby.isArchived,
          dateArchived: oldBaby.dateArchived,
          lastModified: oldBaby.lastModified,
          inviteCode: oldBaby.inviteCode
        };
        
        await setDoc(doc(db, 'baby_profiles', oldBaby.id), enhancedBabyProfile);
        migratedCount++;
        
      } catch (error) {
        this.errors.push(`Failed to migrate baby profile ${babyDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`Migrated ${migratedCount} baby profiles`);
    return migratedCount;
  }
  
  /**
   * Create role assignments for migrated users
   */
  private async createRoleAssignments(organizationId: string): Promise<void> {
    console.log('Creating role assignments...');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    // Get system roles
    const rolesSnapshot = await getDocs(
      query(
        collection(db, 'roles'),
        where('organizationId', '==', organizationId),
        where('isSystemRole', '==', true)
      )
    );
    
    const roleMap = new Map();
    rolesSnapshot.docs.forEach(doc => {
      const role = doc.data();
      roleMap.set(role.name, doc.id);
    });
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const user = userDoc.data() as NewUser;
        const roleId = roleMap.get(user.role);
        
        if (roleId) {
          await RoleService.assignRoleToUser({
            userId: user.uid,
            roleId: roleId,
            organizationId: organizationId,
            assignedBy: 'system'
          });
        }
        
      } catch (error) {
        this.errors.push(`Failed to create role assignment for user ${userDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  /**
   * Cleanup old collections after successful migration
   */
  async cleanupOldCollections(): Promise<void> {
    console.log('Starting cleanup of old collections...');
    
    try {
      // Archive old collections by renaming them
      const collections = ['invites', 'coaches']; // Keep 'users' and 'babies' for now
      
      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        
        // Move documents to archived collection
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.set(
            doc(db, `${collectionName}_archived`, doc.id),
            { ...doc.data(), archivedAt: Timestamp.now() }
          );
          batch.delete(doc.ref);
        });
        
        if (!snapshot.empty) {
          await batch.commit();
          console.log(`Archived ${snapshot.size} documents from ${collectionName} collection`);
        }
      }
      
      await AuditLogger.log({
        action: 'system_backup_created',
        userId: 'system',
        details: {
          collections: collections,
          reason: 'migration_cleanup'
        }
      });
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Helper methods
  
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
  
  private mapInviteStatus(oldStatus: string): 'pending' | 'accepted' | 'expired' | 'cancelled' {
    const statusMap = {
      'pending': 'pending',
      'partially_redeemed': 'pending',
      'completed': 'accepted',
      'expired': 'expired',
      'revoked': 'cancelled'
    };
    
    return statusMap[oldStatus] || 'pending';
  }
  
  private generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * Validate migration readiness
   */
  async validateMigrationReadiness(): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check if old collections exist
      const usersSnapshot = await getDocs(collection(db, 'users'));
      if (usersSnapshot.empty) {
        issues.push('No users found to migrate');
      }
      
      // Check if current collections already exist
      const enhancedUsersSnapshot = await getDocs(collection(db, 'users'));
      const hasEnhancedFields = enhancedUsersSnapshot.docs.some(doc => 
        doc.data().organizationId !== undefined
      );
      
      if (hasEnhancedFields) {
        issues.push('User fields already exist - migration may have been run before');
      }
      
      // Add more validation checks as needed
      
    } catch (error) {
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      ready: issues.length === 0,
      issues
    };
  }
}

// Export migration runner function
export async function runMigration(): Promise<MigrationResult> {
  const migrationService = new MigrationService();
  
  // Validate readiness
  const validation = await migrationService.validateMigrationReadiness();
  if (!validation.ready) {
    console.error('Migration validation failed:', validation.issues);
    return {
      success: false,
      migratedUsers: 0,
      migratedInvitations: 0,
      migratedBabyProfiles: 0,
      errors: validation.issues,
      warnings: []
    };
  }
  
  // Run migration
  return await migrationService.migrate();
}

// Export cleanup function
export async function cleanupAfterMigration(): Promise<void> {
  const migrationService = new MigrationService();
  await migrationService.cleanupOldCollections();
}

