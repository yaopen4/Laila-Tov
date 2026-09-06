// Advanced Role Service for Granular Permission Management
import { 
  doc, 
  collection, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { roleHasPermission, getPermissionsForRole } from '@/lib/permissions';
import type { 
  Permission, 
  Role, 
  UserRoleAssignment, 
  RoleConstraints,
  User,
  AuditAction 
} from '@/types/auth';

export class RoleService {
  
  /**
   * Define all available permissions in the system
   */
  private static readonly SYSTEM_PERMISSIONS: Permission[] = [
    // User Management
    {
      id: 'users.create',
      name: 'Create Users',
      description: 'Create new user accounts',
      category: 'user_management',
      level: 'write'
    },
    {
      id: 'users.read.all',
      name: 'View All Users',
      description: 'View all users in organization',
      category: 'user_management',
      level: 'read'
    },
    {
      id: 'users.read.assigned',
      name: 'View Assigned Users',
      description: 'View users assigned to current user',
      category: 'user_management',
      level: 'read'
    },
    {
      id: 'users.update.all',
      name: 'Edit All Users',
      description: 'Edit any user profile',
      category: 'user_management',
      level: 'write',
      dependencies: ['users.read.all']
    },
    {
      id: 'users.deactivate',
      name: 'Deactivate Users',
      description: 'Deactivate user accounts',
      category: 'user_management',
      level: 'admin',
      dependencies: ['users.read.all']
    },

    // Baby Management
    {
      id: 'babies.create',
      name: 'Create Baby Profiles',
      description: 'Create new baby profiles',
      category: 'baby_management',
      level: 'write'
    },
    {
      id: 'babies.read.all',
      name: 'View All Baby Profiles',
      description: 'View all baby profiles in organization',
      category: 'baby_management',
      level: 'read'
    },
    {
      id: 'babies.read.assigned',
      name: 'View Assigned Baby Profiles',
      description: 'View baby profiles assigned to current user',
      category: 'baby_management',
      level: 'read'
    },
    {
      id: 'babies.update.assigned',
      name: 'Edit Assigned Baby Profiles',
      description: 'Edit baby profiles assigned to current user',
      category: 'baby_management',
      level: 'write',
      dependencies: ['babies.read.assigned']
    },
    {
      id: 'babies.archive',
      name: 'Archive Baby Profiles',
      description: 'Archive completed baby profiles',
      category: 'baby_management',
      level: 'admin',
      dependencies: ['babies.read.assigned']
    },

    // Data Access
    {
      id: 'sleep_data.read.assigned',
      name: 'View Assigned Sleep Data',
      description: 'View sleep data for assigned babies',
      category: 'data_access',
      level: 'read'
    },
    {
      id: 'sleep_data.write.assigned',
      name: 'Edit Assigned Sleep Data',
      description: 'Create and edit sleep data for assigned babies',
      category: 'data_access',
      level: 'write',
      dependencies: ['sleep_data.read.assigned']
    },
    {
      id: 'sleep_data.read.all',
      name: 'View All Sleep Data',
      description: 'View all sleep data in organization',
      category: 'data_access',
      level: 'read'
    },

    // Reporting
    {
      id: 'reports.generate.assigned',
      name: 'Generate Reports for Assigned',
      description: 'Generate reports for assigned babies',
      category: 'reporting',
      level: 'read',
      dependencies: ['sleep_data.read.assigned']
    },
    {
      id: 'reports.generate.all',
      name: 'Generate All Reports',
      description: 'Generate reports for all organization data',
      category: 'reporting',
      level: 'read',
      dependencies: ['sleep_data.read.all']
    },
    {
      id: 'reports.export',
      name: 'Export Reports',
      description: 'Export reports as PDF/Excel files',
      category: 'reporting',
      level: 'write'
    },

    // System Administration
    {
      id: 'system.manage_roles',
      name: 'Manage Roles',
      description: 'Create and modify user roles',
      category: 'system',
      level: 'admin'
    },
    {
      id: 'system.manage_organization',
      name: 'Manage Organization',
      description: 'Modify organization settings',
      category: 'system',
      level: 'admin'
    },
    {
      id: 'system.view_audit_logs',
      name: 'View Audit Logs',
      description: 'Access system audit logs',
      category: 'system',
      level: 'read'
    },
    {
      id: 'system.manage_invitations',
      name: 'Manage Invitations',
      description: 'Create and manage user invitations',
      category: 'system',
      level: 'write'
    }
  ];

  /**
   * System-defined roles that cannot be modified
   */
  private static readonly SYSTEM_ROLES = {
    admin: {
      name: 'admin',
      displayName: 'System Administrator',
      description: 'Full system access with all permissions',
      permissions: [
        'users.create', 'users.read.all', 'users.update.all', 'users.deactivate',
        'babies.create', 'babies.read.all', 'babies.update.assigned', 'babies.archive',
        'sleep_data.read.all', 'sleep_data.write.assigned',
        'reports.generate.all', 'reports.export',
        'system.manage_roles', 'system.manage_organization', 
        'system.view_audit_logs', 'system.manage_invitations'
      ]
    },
    coach: {
      name: 'coach',
      displayName: 'Sleep Coach',
      description: 'Professional sleep consultant with client management capabilities',
      permissions: [
        'users.read.assigned',
        'babies.create', 'babies.read.assigned', 'babies.update.assigned', 'babies.archive',
        'sleep_data.read.assigned', 'sleep_data.write.assigned',
        'reports.generate.assigned', 'reports.export',
        'system.manage_invitations'
      ],
      constraints: {
        maxBabyProfiles: 50,
        maxParentInvitations: 10,
        allowExport: true
      }
    },
    parent: {
      name: 'parent',
      displayName: 'Parent',
      description: 'Parent with access to own baby data',
      permissions: [
        'babies.read.assigned',
        'sleep_data.read.assigned', 'sleep_data.write.assigned',
        'reports.generate.assigned'
      ],
      constraints: {
        maxBabyProfiles: 5,
        allowExport: false
      }
    }
  };

  /**
   * Get all available permissions
   */
  static getSystemPermissions(): Permission[] {
    return [...this.SYSTEM_PERMISSIONS];
  }

  /**
   * Get system role definitions
   */
  static getSystemRoles() {
    return { ...this.SYSTEM_ROLES };
  }

  /**
   * Check whether a user has a permission.
   *
   * Resolved from the static role -> permission map, keyed off the `role` field on the
   * user document. The previous implementation queried `user_role_assignments` joined
   * to `roles`; nothing user-reachable ever wrote those collections, so it returned
   * false for every user and every permission -- which is what blocked baby creation
   * and all sleep-data writes.
   *
   * This is an advisory check for UI and error messages. The enforced boundary is
   * firestore.rules plus the server API routes, both keyed off the custom claims.
   */
  static async userHasPermission(
    userId: string,
    permission: string,
    context?: { babyProfileId?: string; organizationId?: string }
  ): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return false;

      const user = userDoc.data() as User;
      if (user.status && user.status !== 'active') return false;

      return roleHasPermission(user.role, permission);
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Assign role to user with optional context
   */
  static async assignRoleToUser(params: {
    userId: string;
    roleId: string;
    organizationId: string;
    assignedBy: string;
    expiresAt?: Date;
    context?: {
      babyProfileIds?: string[];
      departmentId?: string;
    };
  }): Promise<void> {
    const assignment: UserRoleAssignment = {
      userId: params.userId,
      roleId: params.roleId,
      organizationId: params.organizationId,
      assignedBy: params.assignedBy,
      assignedAt: Timestamp.now(),
      expiresAt: params.expiresAt ? Timestamp.fromDate(params.expiresAt) : undefined,
      isActive: true,
      context: params.context
    };
    
    const assignmentRef = doc(collection(db, 'user_role_assignments'));
    await setDoc(assignmentRef, assignment);
    
    // Update user's cached permissions
    await this.updateUserPermissionsCache(params.userId);
    
    // Log the role assignment
  }

  /**
   * Create custom role
   */
  static async createCustomRole(params: {
    name: string;
    displayName: string;
    description: string;
    organizationId: string;
    permissions: string[];
    constraints?: RoleConstraints;
    createdBy: string;
  }): Promise<string> {
    // Validate permissions exist
    const validPermissions = this.SYSTEM_PERMISSIONS.map(p => p.id);
    const invalidPermissions = params.permissions.filter(p => !validPermissions.includes(p));
    
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }
    
    // Check permission dependencies
    await this.validatePermissionDependencies(params.permissions);
    
    const roleRef = doc(collection(db, 'roles'));
    
    const role: Role = {
      id: roleRef.id,
      name: params.name.toLowerCase().replace(/\s+/g, '_'),
      displayName: params.displayName,
      description: params.description,
      organizationId: params.organizationId,
      isSystemRole: false,
      isActive: true,
      permissions: params.permissions,
      constraints: params.constraints,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: params.createdBy
    };
    
    await setDoc(roleRef, role);

    return roleRef.id;
  }

  /**
   * Validate permission dependencies
   */
  private static async validatePermissionDependencies(permissions: string[]): Promise<void> {
    for (const permission of permissions) {
      const permissionDef = this.SYSTEM_PERMISSIONS.find(p => p.id === permission);
      if (permissionDef?.dependencies) {
        for (const dependency of permissionDef.dependencies) {
          if (!permissions.includes(dependency)) {
            throw new Error(
              `Permission '${permission}' requires '${dependency}' permission`
            );
          }
        }
      }
    }
  }

  /**
   * Update user's cached permissions in Firebase Auth custom claims
   */
  private static async updateUserPermissionsCache(userId: string): Promise<void> {
    const permissions = await this.getUserPermissions(userId);
    
    // Note: This would require Firebase Admin SDK for setting custom claims
    // For now, we'll store permissions in the user document
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      permissions: permissions,
      lastPermissionUpdate: Timestamp.now()
    });
  }

  /**
   * Get all permissions for a user across all roles (PUBLIC METHOD)
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return [];

    const user = userDoc.data() as User;
    return getPermissionsForRole(user.role);
  }

  /**
   * Initialize system roles for an organization
   */
  static async initializeSystemRoles(organizationId: string, createdBy: string): Promise<void> {
    for (const [roleKey, roleData] of Object.entries(this.SYSTEM_ROLES)) {
      const roleRef = doc(collection(db, 'roles'));
      
      const role: Role = {
        id: roleRef.id,
        name: roleData.name,
        displayName: roleData.displayName,
        description: roleData.description,
        organizationId,
        isSystemRole: true,
        isActive: true,
        permissions: roleData.permissions,
        // Not every system role defines constraints.
        constraints: 'constraints' in roleData ? roleData.constraints : undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy
      };
      
      await setDoc(roleRef, role);
    }
  }

  /**
   * Get user's role assignments
   */
  static async getUserRoleAssignments(userId: string, organizationId: string): Promise<UserRoleAssignment[]> {
    const assignments = await getDocs(
      query(
        collection(db, 'user_role_assignments'),
        where('userId', '==', userId),
        where('organizationId', '==', organizationId),
        where('isActive', '==', true)
      )
    );
    
    return assignments.docs.map(doc => doc.data() as UserRoleAssignment);
  }

  static async getAllRoles(organizationId: string): Promise<Role[]> {
    const rolesSnap = await getDocs(
      query(
        collection(db, 'roles'),
        where('organizationId', '==', organizationId)
      )
    );
    return rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
  }

  /**
   * Check role constraints for a user
   */
  static async checkRoleConstraints(
    userId: string, 
    action: string, 
    context?: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { allowed: false, reason: 'User not found' };
    }

    const user = userDoc.data() as User;

    if (user.status && user.status !== 'active') {
      return { allowed: false, reason: 'Account is not active' };
    }

    // Custom roles are optional; a user with none is unconstrained rather than blocked.
    const assignments = await this.getUserRoleAssignments(userId, user.organizationId);

    for (const assignment of assignments) {
      const roleDoc = await getDoc(doc(db, 'roles', assignment.roleId));
      if (!roleDoc.exists()) continue;

      const role = roleDoc.data() as Role;
      if (!role.constraints) continue;

      // Check specific constraints based on action
      switch (action) {
        case 'create_baby_profile':
          if (role.constraints.maxBabyProfiles) {
            // managedBabyProfiles is absent on older user documents; an unguarded
            // .length here threw TypeError and failed the whole check.
            const currentCount = user.managedBabyProfiles?.length ?? 0;
            if (currentCount >= role.constraints.maxBabyProfiles) {
              return { 
                allowed: false, 
                reason: `Maximum baby profiles limit reached (${role.constraints.maxBabyProfiles})` 
              };
            }
          }
          break;

        case 'export_data':
          if (role.constraints.allowExport === false) {
            return { allowed: false, reason: 'Data export not allowed for this role' };
          }
          break;

        case 'time_access':
          if (role.constraints.restrictedTimeAccess) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentDay = now.getDay();
            const restrictions = role.constraints.restrictedTimeAccess;
            
            if (!restrictions.daysOfWeek.includes(currentDay)) {
              return { allowed: false, reason: 'Access not allowed on this day' };
            }
            
            const startHour = parseInt(restrictions.startTime.split(':')[0]);
            const endHour = parseInt(restrictions.endTime.split(':')[0]);
            
            if (currentHour < startHour || currentHour > endHour) {
              return { allowed: false, reason: 'Access not allowed at this time' };
            }
          }
          break;
      }
    }

    return { allowed: true };
  }
}

