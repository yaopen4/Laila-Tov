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
      this.clearUserCache();
      await this.establishSession(credential.user);
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
      this.clearUserCache();

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

      // Server-side route protection reads an httpOnly session cookie, not the
      // client SDK's state. Without it, middleware would bounce every protected page.
      try {
        await this.establishSession(firebaseUser);
      } catch (error) {
        // Without a session cookie every protected page bounces back to login; do
        // not leave the browser half signed in.
        await firebaseSignOut(firebaseAuthInstance).catch(() => undefined);
        this.clearUserCache();
        throw error;
      }

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
      // Clear the server session first; if that request fails the cookie still
      // expires on its own, so it must not block signing out locally.
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
      await firebaseSignOut(firebaseAuthInstance);
      this.clearUserCache();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Exchange the current ID token for the httpOnly session cookie that
   * middleware.ts checks before rendering protected pages.
   */
  static async establishSession(firebaseUser: FirebaseUser): Promise<void> {
    const idToken = await firebaseUser.getIdToken();
    await apiFetchPublic('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
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
   * The resolved current user, shared by every caller (#9).
   *
   * getCurrentUser() is called from ~40 places, often several times per screen. Each
   * call used to attach a listener and re-read /users/{uid}; over a real network that
   * is a round trip apiece. Now concurrent and repeat calls share one in-flight read.
   *
   * Invalidated whenever the signed-in uid changes, on sign-out, and after CACHE_TTL_MS
   * so that a role or status change made by an admin is picked up without a reload.
   */
  private static readonly CACHE_TTL_MS = 60_000;
  private static userCache: {
    uid: string;
    expiresAt: number;
    promise: Promise<AuthUser | null>;
  } | null = null;

  static clearUserCache(): void {
    this.userCache = null;
  }

  /**
   * Get current authenticated user with enhanced data
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    await firebaseAuthInstance.authStateReady();
    const firebaseUser = firebaseAuthInstance.currentUser;
    if (!firebaseUser) {
      this.userCache = null;
      return null;
    }

    const cached = this.userCache;
    if (cached && cached.uid === firebaseUser.uid && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    const promise = this.getEnhancedUserData(firebaseUser.uid)
      .then((enhancedUser) =>
        enhancedUser ? this.convertToAuthUser(firebaseUser, enhancedUser) : null
      )
      .catch((error) => {
        console.error('Error getting current user:', error);
        return null;
      })
      .then((user) => {
        // Never cache a miss: it may be transient (offline, rules not yet deployed).
        if (!user && this.userCache?.promise === promise) this.userCache = null;
        return user;
      });

    this.userCache = {
      uid: firebaseUser.uid,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
      promise,
    };
    return promise;
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

// Drop the cached user whenever the signed-in account changes (sign-in, sign-out,
// a token for a different uid), so no screen can be served the previous user.
if (typeof window !== 'undefined') {
  let lastUid: string | null | undefined;
  firebaseOnAuthStateChanged(firebaseAuthInstance, (user) => {
    const uid = user?.uid ?? null;
    if (lastUid !== undefined && uid !== lastUid) AuthService.clearUserCache();
    lastUid = uid;
  });
}
