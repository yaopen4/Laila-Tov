// Baby Service with RBAC Integration
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  BabyProfile,
} from '@/types/auth';
import type { BabyFormData } from '@/types';
import type { SleepRecord } from '@/types';
import { AuthService } from './authService';
import { RoleService } from './roleService';
import { apiFetch } from '@/lib/apiClient';

/**
 * Sleep record dates are stored as 'YYYY-MM-DD' strings.
 *
 * The form supplies a JS Date, which Firestore would persist as a Timestamp; the UI
 * then reads it back with new Date(...) and gets Invalid Date, crashing date-fns with
 * "RangeError: Invalid time value". Normalising here keeps one representation.
 */
export function toDateKey(value: Date | string | { toDate: () => Date }): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const date = value instanceof Date ? value : value.toDate();
  // Local calendar date, not UTC: toISOString() would shift the day for evening
  // entries in Asia/Jerusalem.
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse a stored sleep-record date back into a Date, tolerating legacy Timestamps. */
export function fromDateKey(value: unknown): Date {
  if (typeof value === 'string') return new Date(`${value}T00:00:00`);
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date(NaN);
}

export class BabyService {
  
  /**
   * Create a new baby profile with permission checks
   */
  static async createBabyProfile(
    babyData: BabyFormData & { parentEmail1?: string; parentEmail2?: string },
    coachId: string,
    organizationId: string
  ): Promise<{ id: string; invitationCode: string | null; secondInvitationCode: string | null }> {
    // Delegated to POST /api/babies, which writes the profile and mints the parent
    // invitation in one place.
    //
    // The old client-side version hardcoded inviteCode to '' and dropped both parent
    // email addresses, so no invitation was ever created and a coach-created baby
    // could never be linked to a parent -- despite the button reading
    // "צור פרופיל וקוד הזמנה". It also wrote gender: undefined, which Firestore
    // rejects outright.
    return await apiFetch<{
      id: string;
      invitationCode: string | null;
      secondInvitationCode: string | null;
    }>('/api/babies', {
      method: 'POST',
      body: JSON.stringify({
        name: babyData.name,
        familyName: babyData.familyName,
        age: babyData.age,
        motherName: babyData.motherName,
        fatherName: babyData.fatherName,
        siblingsCount: babyData.siblingsCount,
        siblingsNames: babyData.siblingsNames,
        description: babyData.description,
        coachNotes: babyData.coachNotes,
        parentEmail1: babyData.parentEmail1,
        parentEmail2: babyData.parentEmail2,
      }),
    });
  }

  /**
   * Get baby profiles with permission-based filtering
   */
  static async getBabyProfiles(userId: string): Promise<BabyProfile[]> {
    const currentUser = await AuthService.getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let queryRef;
    
    if (currentUser.role === 'admin') {
      // Admins can see all baby profiles in their organization
      queryRef = query(
        collection(db, 'baby_profiles'),
        where('organizationId', '==', currentUser.organizationId),
        where('status', '==', 'active'),
        orderBy('familyName')
      );
    } else if (currentUser.role === 'coach') {
      // Coaches can see their assigned baby profiles
      queryRef = query(
        collection(db, 'baby_profiles'),
        where('assignedCoachId', '==', userId),
        where('status', '==', 'active'),
        orderBy('familyName')
      );
    } else if (currentUser.role === 'parent') {
      // Parents can see baby profiles they're assigned to
      queryRef = query(
        collection(db, 'baby_profiles'),
        where('parentIds', 'array-contains', userId)
      );
    } else {
      throw new Error('Invalid user role');
    }

    const snapshot = await getDocs(queryRef);
    const babyProfiles = snapshot.docs.map(doc => doc.data() as BabyProfile);

    return babyProfiles;
  }

  /**
   * Get a single baby profile with permission check
   */
  static async getBabyProfile(
    babyId: string,
    userId?: string
  ): Promise<BabyProfile | null> {
    // Allow caller to omit userId and use the current authenticated user
    if (!userId) {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      userId = currentUser.uid;
    }
    const babyDoc = await getDoc(doc(db, 'baby_profiles', babyId));
    
    if (!babyDoc.exists()) {
    return null;
    }

    const babyProfile = babyDoc.data() as BabyProfile;

    // Check if user has access to this baby profile
    const hasAccess = await this.checkBabyAccess(userId, babyProfile);
    
    if (!hasAccess) {
      
      throw new Error('Access denied to this baby profile');
    }

    return babyProfile;
  }

  /**
   * Update baby profile with permission checks
   */
  static async updateBabyProfile(
    babyId: string,
    updates: Partial<BabyProfile>,
    userId?: string
  ): Promise<void> {
    if (!userId) {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');
      userId = currentUser.uid;
    }

    const babyProfile = await this.getBabyProfile(babyId, userId);
    
    if (!babyProfile) {
      throw new Error('Baby profile not found');
    }

    // Check update permissions
    const hasPermission = await RoleService.userHasPermission(
      userId,
      'babies.update.assigned',
      { babyProfileId: babyId }
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to update baby profile');
    }

    const previousValues = { ...babyProfile };
    
    // Prepare update data
    const updateData = {
      ...updates,
      lastUpdatedAt: Timestamp.now(),
      lastModified: new Date().toISOString()
    };

    await updateDoc(doc(db, 'baby_profiles', babyId), updateData);
  }

  /**
   * Archive baby profile
   */
  static async archiveBabyProfile(
    babyId: string,
    userId?: string
  ): Promise<void> {
    if (!userId) {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');
      userId = currentUser.uid;
    }
    const hasPermission = await RoleService.userHasPermission(
      userId,
      'babies.archive',
      { babyProfileId: babyId }
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to archive baby profile');
    }

    const updateData = {
      status: 'archived' as const,
      isArchived: true,
      dateArchived: new Date().toISOString(),
      lastUpdatedAt: Timestamp.now()
    };

    await updateDoc(doc(db, 'baby_profiles', babyId), updateData);

    // Log archive action
  }

  /**
   * Restore archived baby profile
   */
  static async restoreBabyProfile(
    babyId: string,
    userId?: string
  ): Promise<void> {
    if (!userId) {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');
      userId = currentUser.uid;
    }
    const hasPermission = await RoleService.userHasPermission(
      userId,
      'babies.archive',
      { babyProfileId: babyId }
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to restore baby profile');
    }

    const updateData = {
      status: 'active' as const,
    isArchived: false,
    dateArchived: null,
      lastUpdatedAt: Timestamp.now()
    };

    await updateDoc(doc(db, 'baby_profiles', babyId), updateData);

    // Log restore action
  }

  /**
   * Add parent to baby profile
   */
  static async addParentToBabyProfile(
    babyId: string,
    parentId: string,
    userId: string
  ): Promise<void> {
    const hasPermission = await RoleService.userHasPermission(
      userId,
      'babies.update.assigned',
      { babyProfileId: babyId }
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to modify baby profile');
    }

    await updateDoc(doc(db, 'baby_profiles', babyId), {
      parentIds: arrayUnion(parentId),
      lastUpdatedAt: Timestamp.now()
    });

    // Update parent's managed baby profiles
    await updateDoc(doc(db, 'users', parentId), {
      managedBabyProfiles: arrayUnion(babyId)
    });

    // Log action
  }

  /**
   * Remove parent from baby profile
   */
  static async removeParentFromBabyProfile(
    babyId: string,
    parentId: string,
    userId: string
  ): Promise<void> {
    const hasPermission = await RoleService.userHasPermission(
      userId,
      'babies.update.assigned',
      { babyProfileId: babyId }
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to modify baby profile');
    }

    await updateDoc(doc(db, 'baby_profiles', babyId), {
      parentIds: arrayRemove(parentId),
      lastUpdatedAt: Timestamp.now()
    });

    // Update parent's managed baby profiles
    await updateDoc(doc(db, 'users', parentId), {
      managedBabyProfiles: arrayRemove(babyId)
    });

    // Log action
  }

  /**
   * Transfer baby profile to another coach
   */
  static async transferBabyProfile(
    babyId: string,
    newCoachId: string,
    userId: string
  ): Promise<void> {
    // Only admins can transfer baby profiles
    const currentUser = await AuthService.getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only administrators can transfer baby profiles');
    }

    const babyProfile = await this.getBabyProfile(babyId, userId);
    
    if (!babyProfile) {
      throw new Error('Baby profile not found');
    }

    const previousCoachId = babyProfile.assignedCoachId;

    await updateDoc(doc(db, 'baby_profiles', babyId), {
      assignedCoachId: newCoachId,
      lastUpdatedAt: Timestamp.now()
    });

    // Update coach profiles
    await this.removeBabyFromCoachProfile(previousCoachId, babyId);
    await this.addBabyToCoachProfile(newCoachId, babyId);

    // Log transfer
  }

  /**
   * Get sleep records for a baby with permission checks
   */
  static async getSleepRecords(
    babyId: string,
    userId: string
  ): Promise<SleepRecord[]> {
    // Check if user has access to this baby
    const babyProfile = await this.getBabyProfile(babyId, userId);
    
    if (!babyProfile) {
      throw new Error('Baby profile not found or access denied');
    }

    const sleepRecordsQuery = query(
      collection(db, 'baby_profiles', babyId, 'sleep_records'),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(sleepRecordsQuery);
    const sleepRecords = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SleepRecord[];

    return sleepRecords;
  }

  /**
   * Convenience: get coach's active babies
   */
  static async getBabiesForCoach(coachId: string): Promise<BabyProfile[]> {
    const babies = await this.getBabyProfiles(coachId);
    return babies.filter(b => b.status !== 'archived' && b.assignedCoachId === coachId);
  }

  /**
   * Archived babies for a coach.
   *
   * The archive page called this, unarchiveBabyProfile and deleteBabyProfile; none of
   * the three existed on BabyService, so the whole page threw at runtime. The
   * ignoreBuildErrors flag in next.config.ts meant the build never said so.
   */
  static async getArchivedBabiesForCoach(coachId: string): Promise<BabyProfile[]> {
    const snapshot = await getDocs(
      query(
        collection(db, 'baby_profiles'),
        where('assignedCoachId', '==', coachId),
        where('status', '==', 'archived')
      )
    );
    return snapshot.docs
      .map((docSnap) => docSnap.data() as BabyProfile)
      .sort((a, b) => (a.familyName ?? '').localeCompare(b.familyName ?? '', 'he'));
  }

  /** Alias for restoreBabyProfile, which is the name the archive page uses. */
  static async unarchiveBabyProfile(babyId: string, userId?: string): Promise<void> {
    return this.restoreBabyProfile(babyId, userId);
  }

  /**
   * Permanently delete a baby profile.
   *
   * Admin only, matching firestore.rules: a coach archives, an admin deletes. Sleep
   * records live in a subcollection and are not removed by deleting the parent
   * document, so they are cleared first — otherwise they would linger unreachable.
   */
  static async deleteBabyProfile(babyId: string, userId?: string): Promise<void> {
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');

    const actingUserId = userId ?? currentUser.uid;

    if (currentUser.role !== 'admin') {
      throw new Error('Only an administrator can permanently delete a baby profile');
    }

    const records = await getDocs(collection(db, 'baby_profiles', babyId, 'sleep_records'));
    await Promise.all(records.docs.map((record) => deleteDoc(record.ref)));
    await deleteDoc(doc(db, 'baby_profiles', babyId));
  }

  /**
   * Convenience: get sleep records for a baby using the current user
   */
  static async getSleepRecordsForBaby(babyId: string): Promise<SleepRecord[]> {
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return this.getSleepRecords(babyId, currentUser.uid);
  }

  /**
   * Convenience: add a new sleep record (wraps saveSleepRecord)
   */
  static async addSleepRecord(
    babyId: string,
    data: Omit<SleepRecord, 'id'>
  ): Promise<string> {
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return this.saveSleepRecord(babyId, data, currentUser.uid);
  }

  /**
   * Update an existing sleep record
   */
  static async updateSleepRecord(
    babyId: string,
    recordId: string,
    updates: Partial<SleepRecord>
  ): Promise<void> {
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    // Permission check
    const hasPermission = await RoleService.userHasPermission(
      currentUser.uid,
      'sleep_data.write.assigned',
      { babyProfileId: babyId }
    );
    if (!hasPermission) {
      throw new Error('Insufficient permissions to update sleep data');
    }

    const recordRef = doc(collection(db, 'baby_profiles', babyId, 'sleep_records'), recordId);
    const previousDoc = await getDoc(recordRef);
    const previousValues = previousDoc.exists() ? previousDoc.data() : undefined;

    await setDoc(recordRef, { ...updates, id: recordId }, { merge: true });

    await updateDoc(doc(db, 'baby_profiles', babyId), {
      lastUpdatedAt: Timestamp.now(),
      lastModified: new Date().toISOString()
    });
  }

  /**
   * Delete a sleep record
   */
  static async deleteSleepRecord(
    babyId: string,
    recordId: string
  ): Promise<void> {
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    const hasPermission = await RoleService.userHasPermission(
      currentUser.uid,
      'sleep_data.write.assigned',
      { babyProfileId: babyId }
    );
    if (!hasPermission) {
      throw new Error('Insufficient permissions to delete sleep data');
    }

    await deleteDoc(doc(db, 'baby_profiles', babyId, 'sleep_records', recordId));
  }

  /**
   * Create or update sleep record
   */
  static async saveSleepRecord(
    babyId: string,
    sleepRecord: Omit<SleepRecord, 'id'>,
    userId: string
  ): Promise<string> {
    // Check permissions
    const hasPermission = await RoleService.userHasPermission(
      userId,
      'sleep_data.write.assigned',
      { babyProfileId: babyId }
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to save sleep data');
    }

    const sleepRecordRef = doc(collection(db, 'baby_profiles', babyId, 'sleep_records'));
    const sleepRecordWithId = {
      ...sleepRecord,
      // Always a 'YYYY-MM-DD' string, whatever the form handed us.
      date: toDateKey(sleepRecord.date as unknown as Date | string),
      id: sleepRecordRef.id,
      timestamp: Timestamp.now()
    };

    await setDoc(sleepRecordRef, sleepRecordWithId);

    // Update baby profile last modified
    await updateDoc(doc(db, 'baby_profiles', babyId), {
      lastUpdatedAt: Timestamp.now(),
      lastModified: new Date().toISOString()
    });

    return sleepRecordRef.id;
  }

  // Private helper methods

  /**
   * Check if user has access to a baby profile
   */
  private static async checkBabyAccess(
    userId: string,
    babyProfile: BabyProfile
  ): Promise<boolean> {
    const currentUser = await AuthService.getCurrentUser();
    
    if (!currentUser) return false;

    // Admin access to same organization
    if (currentUser.role === 'admin') {
      return currentUser.organizationId === babyProfile.organizationId;
    }

    // Coach access to assigned babies
    if (currentUser.role === 'coach') {
      return babyProfile.assignedCoachId === userId;
    }

    // Parent access to their babies
    if (currentUser.role === 'parent') {
      return babyProfile.parentIds.includes(userId);
    }

    return false;
  }

  /**
   * Add baby to coach's managed profiles
   */
  private static async addBabyToCoachProfile(
    coachId: string,
    babyId: string
  ): Promise<void> {
    await updateDoc(doc(db, 'users', coachId), {
      managedBabyProfiles: arrayUnion(babyId)
    });
  }

  /**
   * Remove baby from coach's managed profiles
   */
  private static async removeBabyFromCoachProfile(
    coachId: string,
    babyId: string
  ): Promise<void> {
    await updateDoc(doc(db, 'users', coachId), {
      managedBabyProfiles: arrayRemove(babyId)
    });
  }

  /**
   * Calculate date of birth from age in months
   */
  private static calculateDateOfBirth(ageInMonths: number): Timestamp {
    const now = new Date();
    const birthDate = new Date(now.getFullYear(), now.getMonth() - ageInMonths, now.getDate());
    return Timestamp.fromDate(birthDate);
  }

  /**
   * Get baby profiles with advanced filtering
   */
  static async getBabyProfilesWithFilters(
    userId: string,
    filters: {
      status?: 'active' | 'archived' | 'transferred';
      coachId?: string;
      organizationId?: string;
      ageRange?: { min: number; max: number };
      searchTerm?: string;
    }
  ): Promise<BabyProfile[]> {
    let allProfiles = await this.getBabyProfiles(userId);

    // Apply filters
    if (filters.status) {
      allProfiles = allProfiles.filter(profile => profile.status === filters.status);
    }

    if (filters.coachId) {
      allProfiles = allProfiles.filter(profile => profile.assignedCoachId === filters.coachId);
    }

    if (filters.ageRange) {
      allProfiles = allProfiles.filter(profile => 
        profile.age >= filters.ageRange!.min && profile.age <= filters.ageRange!.max
      );
    }

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      allProfiles = allProfiles.filter(profile =>
        profile.name.toLowerCase().includes(searchLower) ||
        profile.familyName.toLowerCase().includes(searchLower) ||
        profile.motherName.toLowerCase().includes(searchLower) ||
        profile.fatherName.toLowerCase().includes(searchLower)
      );
    }

    return allProfiles;
  }

  /**
   * Get baby profile statistics for dashboard
   */
  static async getBabyProfileStats(userId: string): Promise<{
    total: number;
    active: number;
    archived: number;
    recentlyCreated: number;
  }> {
    const profiles = await this.getBabyProfiles(userId);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return {
      total: profiles.length,
      active: profiles.filter(p => p.status === 'active').length,
      archived: profiles.filter(p => p.status === 'archived').length,
      recentlyCreated: profiles.filter(p => 
        p.createdAt.toDate() > oneWeekAgo
      ).length
    };
  }
}

