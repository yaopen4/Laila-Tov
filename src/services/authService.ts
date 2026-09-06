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
import { InvitationService } from './invitationService';
import { apiFetchPublic } from '@/lib/apiClient';
import { getRedirectPathForRole } from '@/lib/permissions';

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
   * Register by redeeming an invitation code.
   *
   * Delegates to POST /api/auth/register, which does the whole thing with the Admin
   * SDK: create the Auth user, set the role/organizationId custom claims, write the
   * user document, mark the invitation redeemed, and link a parent to their baby.
   *
   * The client cannot do this itself. Creating /users/{uid} is gated on a rule that
   * reads /users/{uid}, so the first write was always denied; the old code then
   * deleted the freshly created Auth account, and every registration rolled itself
   * back. Custom claims also require the Admin SDK -- the previous version "simulated"
   * them in localStorage, which no security rule can trust.
   *
   * After the server responds we sign in normally, so the resulting ID token carries
   * the claims.
   */
  static async registerWithInvitation(
    invitationCode: string,
    email: string,
    password: string,
    displayName: string
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    redirectPath?: string;
    error?: string;
  }> {
    try {
      const result = await apiFetchPublic<{
        uid: string;
        role: 'admin' | 'coach' | 'parent';
        organizationId: string;
        redirectPath: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ invitationCode, email, password, displayName }),
      });

      // Sign in to pick up an ID token containing the new claims.
      const credential = await signInWithEmailAndPassword(firebaseAuthInstance, email, password);
      const enhancedUser = await this.getEnhancedUserData(credential.user.uid);

      return {
        success: true,
        user: enhancedUser ? this.convertToAuthUser(credential.user, enhancedUser) : undefined,
        redirectPath: result.redirectPath,
      };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ההרשמה נכשלה. נסה שוב.',
      };
    }
  }

  /**
   * Enhanced login with audit logging and permission loading
   */
  static async loginWithEmail(
    email: string, 
    password: string
  ): Promise<AuthUser> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();

    try {
      // Log login attempt

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

      return this.convertToAuthUser(firebaseUser, enhancedUser);
    } catch (error) {
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
    } catch (error) {
      // Log failed password reset

      throw error;
    }
  }

  /**
   * Enhanced auth state change listener
   */
  static onAuthStateChanged(
    callback: (user: AuthUser | null) => void
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
  static async getCurrentUser(): Promise<AuthUser | null> {
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
      throw new Error('User not authenticated');
    }
    
    if (currentUser.role !== 'admin') {
      throw new Error('Admin access required');
    }
  }

  /**
   * Role-based access checks
   */
  static isAdmin(user: AuthUser | null): boolean {
    return user?.role === 'admin';
  }

  static isCoach(user: AuthUser | null): boolean {
    return user?.role === 'coach';
  }

  static isParent(user: AuthUser | null): boolean {
    return user?.role === 'parent';
  }

  /**
   * Organization-based access checks
   */
  static async ensureSameOrganization(
    targetUserId: string,
    currentUser?: AuthUser
  ): Promise<boolean> {
    if (!currentUser) {
      const resolved = await this.getCurrentUser();
      if (!resolved) return false;
      currentUser = resolved;
    }

    const targetUser = await this.getEnhancedUserData(targetUserId);
    
    return targetUser?.organizationId === currentUser.organizationId;
  }

  // Private helper methods

  /**
   * Get enhanced user data from Firestore
   */
  private static async getEnhancedUserData(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting enhanced user data:', error);
      return null;
    }
  }

  /**
   * Convert a Firebase User plus its user document into an AuthUser.
   */
  private static convertToAuthUser(
    firebaseUser: FirebaseUser,
    enhancedUser: User
  ): AuthUser {
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
   * Current user's permissions, derived from their role.
   *
   * Replaces a localStorage-backed "custom claims simulation". Storing an
   * authorization decision somewhere the subject can edit is not a cache, it is an
   * open door -- and rules and API routes could never have trusted it. Real claims
   * now live in the signed ID token, set server-side at registration.
   */
  static async refreshUserPermissions(userId?: string): Promise<string[]> {
    try {
      const currentUser = await this.getCurrentUser();
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) return [];
      return await RoleService.getUserPermissions(targetUserId);
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
  static getRedirectPath(user: AuthUser): string {
    return getRedirectPathForRole(user.role, user.managedBabyProfiles ?? []);
  }
}

