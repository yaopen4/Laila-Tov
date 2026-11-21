// Baby Service with RBAC Integration
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  BabyProfile,
  BabyFormData,
  SleepRecord,
} from '@/types/auth';
import { AuthService } from './authService';
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
   * Edit a profile's descriptive fields. Runs server-side so it is audited (#4);
   * the server re-checks that the caller may edit this baby.
   */
  static async updateBabyProfile(babyId: string, updates: Partial<BabyFormData>): Promise<void> {
    await apiFetch(`/api/babies/${encodeURIComponent(babyId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: updates.name,
        familyName: updates.familyName,
        age: updates.age,
        motherName: updates.motherName,
        fatherName: updates.fatherName,
        siblingsCount: updates.siblingsCount,
        siblingsNames: updates.siblingsNames,
        description: updates.description,
        coachNotes: updates.coachNotes,
      }),
    });
  }

  /** Archive a profile (coach, admin). Audited server-side. */
  static async archiveBabyProfile(babyId: string): Promise<void> {
    await this.setArchived(babyId, true);
  }

  /** Restore an archived profile (coach, admin). Audited server-side. */
  static async restoreBabyProfile(babyId: string): Promise<void> {
    await this.setArchived(babyId, false);
  }

  private static async setArchived(babyId: string, archived: boolean): Promise<void> {
    await apiFetch(`/api/babies/${encodeURIComponent(babyId)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archived }),
    });
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
  static async unarchiveBabyProfile(babyId: string): Promise<void> {
    return this.restoreBabyProfile(babyId);
  }

  /**
   * Permanently delete a baby profile and its sleep records.
   * Admin only, enforced server-side: a coach archives, an admin deletes.
   */
  static async deleteBabyProfile(babyId: string): Promise<void> {
    await apiFetch(`/api/babies/${encodeURIComponent(babyId)}`, { method: 'DELETE' });
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
   * The body the sleep-record routes accept. The date is converted to a local
   * calendar key HERE, in the family's own timezone; the server's would be wrong.
   */
  private static sleepRecordBody(data: Partial<SleepRecord> | Omit<SleepRecord, 'id'>): string {
    return JSON.stringify({
      date: toDateKey(data.date as unknown as Date | string),
      sleepCycles: data.sleepCycles,
    });
  }

  /** Log a day's sleep. Returns the new record's id. */
  static async addSleepRecord(babyId: string, data: Omit<SleepRecord, 'id'>): Promise<string> {
    const { id } = await apiFetch<{ id: string }>(
      `/api/babies/${encodeURIComponent(babyId)}/sleep-records`,
      { method: 'POST', body: this.sleepRecordBody(data) }
    );
    return id;
  }

  /**
   * Replace a day's record. The previous client-side version wrote the form's Date
   * object as-is, storing a Timestamp that later rendered as Invalid Date; the shared
   * body builder normalises it like a new record.
   */
  static async updateSleepRecord(
    babyId: string,
    recordId: string,
    updates: Partial<SleepRecord>
  ): Promise<void> {
    await apiFetch(
      `/api/babies/${encodeURIComponent(babyId)}/sleep-records/${encodeURIComponent(recordId)}`,
      { method: 'PATCH', body: this.sleepRecordBody(updates) }
    );
  }

  /** Delete a sleep record. */
  static async deleteSleepRecord(babyId: string, recordId: string): Promise<void> {
    await apiFetch(
      `/api/babies/${encodeURIComponent(babyId)}/sleep-records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' }
    );
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

