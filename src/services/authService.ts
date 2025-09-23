// Authentication Service with Advanced RBAC Integration
import {
  signInWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  collection, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { auth as firebaseAuthInstance, db } from '@/lib/firebase';
import type { 
  User, 
  Invitation,
  ValidationResult 
} from '@/types/auth';
import { RoleService } from './roleService';
import { AuditLogger } from './auditLogger';
import { InvitationService } from './invitationService';

// AuthUser interface that extends Firebase User with our custom data
export interface AuthUser extends FirebaseUser {
  role?: User['role'];
  status?: User['status'];
  organizationId?: string;
  permissions?: string[];
  assignedCoachId?: string;
  managedBabyProfiles?: string[];
  preferences?: User['preferences'];
}

export class AuthService {
  private static invitationService = new InvitationService();

  /**
   * Enhanced user registration with invitation validation
   */
  static async registerWithInvitation(
    invitationCode: string,
    email: string,
    password: string,
    displayName: string
  ): Promise<{
    success: boolean;
    user?: EnhancedAuthUser;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Log registration attempt
      await AuditLogger.log({
        action: 'user_registered',
        userId: 'anonymous',
        details: {
          email,
          invitationCode,
          step: 'validation_start'
        }
      });

      // Validate invitation
      const invitation = await this.invitationService.getInvitationByCode(invitationCode);
      
      if (!invitation) {
        return { 
          success: false, 
          error: 'Invalid invitation code' 
        };
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return { 
          success: false, 
          error: 'Email does not match invitation' 
        };
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuthInstance, 
        email, 
        password
      );
      const firebaseUser = userCredential.user;

      try {
        // Accept invitation and create enhanced user
        const acceptResult = await this.invitationService.acceptInvitation(
          invitationCode, 
          firebaseUser.uid
        );

        if (!acceptResult.success) {
          // Clean up Firebase user if invitation acceptance fails
          await firebaseUser.delete();
          return {
            success: false,
            error: acceptResult.error || 'Failed to accept invitation'
          };
        }

        // Update user profile with display name
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          displayName: displayName
        });

        // Get the complete user data
        const enhancedUser = await this.getEnhancedUserData(firebaseUser.uid);
        
        if (!enhancedUser) {
          throw new Error('Failed to retrieve user data after registration');
        }

        // Update Firebase Auth custom claims
        // Note: This would normally be done by Cloud Functions with Admin SDK
        // For client-side, we simulate this with local storage or context
        await this.updateUserPermissionsCache(enhancedUser);

        // Log successful registration
        await AuditLogger.log({
          action: 'user_registered',
          userId: firebaseUser.uid,
          targetType: 'user',
          targetId: firebaseUser.uid,
          details: {
            email: enhancedUser.email,
            role: enhancedUser.role,
            organizationId: enhancedUser.organizationId,
            invitationCode,
            duration: Date.now() - startTime
          }
        });

        return {
          success: true,
          user: this.convertToAuthUser(firebaseUser, enhancedUser)
        };

      } catch (setupError) {
        // Clean up Firebase user if setup fails
        try {
          await firebaseUser.delete();
        } catch (deleteError) {
          console.error('Failed to clean up Firebase user:', deleteError);
        }
        throw setupError;
      }

    } catch (error) {
      console.error('Registration failed:', error);

      // Log failed registration
      await AuditLogger.log({
        action: 'user_registered',
        userId: 'anonymous',
        details: {
          email,
          invitationCode,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Enhanced login with audit logging and permission loading
   */
  static async loginWithEmail(
    email: string, 
    password: string
  ): Promise<EnhancedAuthUser> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();

    try {
      // Log login attempt
      await AuditLogger.logSession({
        userId: 'anonymous',
        action: 'login',
        success: false, // Will update if successful
        loginMethod: 'email'
      });

      // Firebase authentication
      const userCredential = await signInWithEmailAndPassword(
        firebaseAuthInstance, 
        normalizedEmail, 
        password
      );
      const firebaseUser = userCredential.user;

      // Get enhanced user data
      const enhancedUser = await this.getEnhancedUserData(firebaseUser.uid);
      
      if (!enhancedUser) {
        throw new Error('User profile not found');
      }

      // Check user status
      if (enhancedUser.status !== 'active') {
        throw new Error(`Account is ${enhancedUser.status}. Please contact support.`);
      }

      // Update last login time
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: Timestamp.now()
      });

      // Update permissions cache
      await this.updateUserPermissionsCache(enhancedUser);

      // Log successful login
      await AuditLogger.logSession({
        userId: firebaseUser.uid,
        action: 'login',
        success: true,
        loginMethod: 'email'
      });

      await AuditLogger.log({
        action: 'user_login',
        userId: firebaseUser.uid,
        details: {
          email: enhancedUser.email,
          role: enhancedUser.role,
          organizationId: enhancedUser.organizationId,
          duration: Date.now() - startTime
        }
      });

      return this.convertToAuthUser(firebaseUser, enhancedUser);

    } catch (error) {
      // Log failed login
      await AuditLogger.logSession({
        userId: 'anonymous',
        action: 'login',
        success: false,
        loginMethod: 'email',
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced logout with audit logging
   */
  static async signOut(): Promise<void> {
    try {
      const currentUser = firebaseAuthInstance.currentUser;
      const userId = currentUser?.uid;

      await firebaseSignOut(firebaseAuthInstance);

      // Log successful logout
      if (userId) {
        await AuditLogger.logSession({
          userId,
          action: 'logout',
          success: true
        });
      }

    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced password reset with audit logging
   */
  static async sendPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    try {
      await sendPasswordResetEmail(firebaseAuthInstance, normalizedEmail);

      // Log password reset request
      await AuditLogger.log({
        action: 'password_reset_requested',
        userId: 'anonymous',
        details: {
          email: normalizedEmail
        }
      });

    } catch (error) {
      // Log failed password reset
      await AuditLogger.log({
        action: 'password_reset_requested',
        userId: 'anonymous',
        details: {
          email: normalizedEmail,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Enhanced auth state change listener
   */
  static onAuthStateChanged(
    callback: (user: EnhancedAuthUser | null) => void
  ): () => void {
    return firebaseOnAuthStateChanged(firebaseAuthInstance, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const enhancedUser = await this.getEnhancedUserData(firebaseUser.uid);
          
          if (enhancedUser) {
            callback(this.convertToAuthUser(firebaseUser, enhancedUser));
          } else {
            console.warn(`No enhanced user data found for ${firebaseUser.uid}`);
            callback(null);
          }
        } catch (error) {
          console.error('Error loading enhanced user data:', error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get current authenticated user with enhanced data
   */
  static async getCurrentUser(): Promise<EnhancedAuthUser | null> {
    return new Promise((resolve) => {
      const unsubscribe = firebaseOnAuthStateChanged(firebaseAuthInstance, async (firebaseUser) => {
        unsubscribe();
        
        if (firebaseUser) {
          try {
            const enhancedUser = await this.getEnhancedUserData(firebaseUser.uid);
            
            if (enhancedUser) {
              resolve(this.convertToAuthUser(firebaseUser, enhancedUser));
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('Error getting current user:', error);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Check if user has specific permission
   */
  static async userHasPermission(
    permission: string,
    context?: { babyProfileId?: string; organizationId?: string }
  ): Promise<boolean> {
    const currentUser = await this.getCurrentUser();
    
    if (!currentUser) return false;

    return await RoleService.userHasPermission(
      currentUser.uid,
      permission,
      context
    );
  }

  /**
   * Check role constraints for current user
   */
  static async checkRoleConstraints(
    action: string,
    context?: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    const currentUser = await this.getCurrentUser();
    
    if (!currentUser) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    return await RoleService.checkRoleConstraints(
      currentUser.uid,
      action,
      context
    );
  }

  /**
   * Admin access verification
   */
  static async ensureAdminAccess(): Promise<void> {
    const currentUser = await this.getCurrentUser();
    
    if (!currentUser) {
      await AuditLogger.log({
        action: 'unauthorized_access_attempt',
        userId: 'anonymous',
        details: {
          reason: 'not_authenticated',
          requiredAccess: 'admin'
        },
        success: false
      });
      throw new Error('User not authenticated');
    }
    
    if (currentUser.role !== 'admin') {
      await AuditLogger.log({
        action: 'unauthorized_access_attempt',
        userId: currentUser.uid,
        details: {
          reason: 'insufficient_permissions',
          userRole: currentUser.role,
          requiredAccess: 'admin'
        },
        success: false
      });
      throw new Error('Admin access required');
    }
  }

  /**
   * Role-based access checks
   */
  static isAdmin(user: EnhancedAuthUser | null): boolean {
    return user?.role === 'admin';
  }

  static isCoach(user: EnhancedAuthUser | null): boolean {
    return user?.role === 'coach';
  }

  static isParent(user: EnhancedAuthUser | null): boolean {
    return user?.role === 'parent';
  }

  /**
   * Organization-based access checks
   */
  static async ensureSameOrganization(
    targetUserId: string,
    currentUser?: EnhancedAuthUser
  ): Promise<boolean> {
    if (!currentUser) {
      currentUser = await this.getCurrentUser();
      if (!currentUser) return false;
    }

    const targetUser = await this.getEnhancedUserData(targetUserId);
    
    return targetUser?.organizationId === currentUser.organizationId;
  }

  // Private helper methods

  /**
   * Get enhanced user data from Firestore
   */
  private static async getEnhancedUserData(userId: string): Promise<EnhancedUser | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        return userDoc.data() as EnhancedUser;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting enhanced user data:', error);
      return null;
    }
  }

  /**
   * Convert Firebase User + Enhanced User data to EnhancedAuthUser
   */
  private static convertToAuthUser(
    firebaseUser: FirebaseUser,
    enhancedUser: EnhancedUser
  ): EnhancedAuthUser {
    return {
      ...firebaseUser,
      role: enhancedUser.role,
      status: enhancedUser.status,
      organizationId: enhancedUser.organizationId,
      permissions: enhancedUser.permissions,
      assignedCoachId: enhancedUser.assignedCoachId,
      managedBabyProfiles: enhancedUser.managedBabyProfiles,
      preferences: enhancedUser.preferences
    };
  }

  /**
   * Update user permissions cache (client-side simulation)
   */
  private static async updateUserPermissionsCache(user: EnhancedUser): Promise<void> {
    try {
      // In a real implementation, this would be handled by Firebase Cloud Functions
      // with the Admin SDK. For client-side, we can store in localStorage or context
      
      const permissionsCache = {
        userId: user.uid,
        permissions: user.permissions,
        role: user.role,
        organizationId: user.organizationId,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem('userPermissionsCache', JSON.stringify(permissionsCache));
      
    } catch (error) {
      console.error('Error updating permissions cache:', error);
    }
  }

  /**
   * Get cached permissions (client-side)
   */
  static getCachedPermissions(): string[] {
    try {
      const cache = localStorage.getItem('userPermissionsCache');
      if (cache) {
        const parsed = JSON.parse(cache);
        // Check if cache is recent (less than 1 hour old)
        if (Date.now() - parsed.lastUpdated < 60 * 60 * 1000) {
          return parsed.permissions || [];
        }
      }
    } catch (error) {
      console.error('Error getting cached permissions:', error);
    }
    return [];
  }

  /**
   * Clear permissions cache
   */
  static clearPermissionsCache(): void {
    try {
      localStorage.removeItem('userPermissionsCache');
    } catch (error) {
      console.error('Error clearing permissions cache:', error);
    }
  }

  /**
   * Refresh user permissions from server
   */
  static async refreshUserPermissions(userId?: string): Promise<string[]> {
    try {
      const currentUser = await this.getCurrentUser();
      const targetUserId = userId || currentUser?.uid;
      
      if (!targetUserId) return [];

      // Get fresh permissions from role service
      const permissions = await RoleService.getUserPermissions(targetUserId);
      
      // Update cache
      if (targetUserId === currentUser?.uid) {
        const enhancedUser = await this.getEnhancedUserData(targetUserId);
        if (enhancedUser) {
          await this.updateUserPermissionsCache({
            ...enhancedUser,
            permissions
          });
        }
      }
      
      return permissions;
      
    } catch (error) {
      console.error('Error refreshing user permissions:', error);
      return [];
    }
  }

  /**
   * Validate invitation code format
   */
  static validateInvitationCode(code: string): ValidationResult {
    if (!code || typeof code !== 'string') {
      return { isValid: false, reason: 'Invalid invitation code format' };
    }
    
    const trimmedCode = code.trim().toUpperCase();
    
    if (trimmedCode.length !== 8) {
      return { isValid: false, reason: 'Invitation code must be 8 characters long' };
    }
    
    if (!/^[A-Z0-9]+$/.test(trimmedCode)) {
      return { isValid: false, reason: 'Invitation code contains invalid characters' };
    }
    
    return { isValid: true };
  }

  /**
   * Get user's redirect path based on role and context
   */
  static getRedirectPath(user: EnhancedAuthUser): string {
    switch (user.role) {
      case 'admin':
        return '/admin/dashboard';
      case 'coach':
        return '/coach/dashboard';
      case 'parent':
        // For parents, redirect to their baby's page if they have one
        if (user.managedBabyProfiles && user.managedBabyProfiles.length > 0) {
          return `/parent/${user.managedBabyProfiles[0]}`;
        }
        return '/parent/dashboard';
      default:
        return '/';
    }
  }
}

