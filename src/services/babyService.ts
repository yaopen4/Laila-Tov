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
  BabyFormData 
} from '@/types/auth';
import type { SleepRecord } from '@/types';
import { AuthService } from './authService';
import { RoleService } from './roleService';
import { AuditLogger } from './auditLogger';

export class BabyService {
  
  /**
   * Create a new baby profile with permission checks
   */
  static async createBabyProfile(
    babyData: BabyFormData,
    coachId: string,
    organizationId: string
  ): Promise<string> {
    // Check permissions
    const hasPermission = await RoleService.userHasPermission(
      coachId,
      'babies.create'
    );
    
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create baby profile');
    }

    // Check role constraints
    const constraintCheck = await RoleService.checkRoleConstraints(
      coachId,
      'create_baby_profile'
    );
    
    if (!constraintCheck.allowed) {
      throw new Error(constraintCheck.reason || 'Role constraints prevent baby profile creation');
    }

    const babyRef = doc(collection(db, 'baby_profiles'));
    
    const babyProfile: BabyProfile = {
      id: babyRef.id,
      name: babyData.name,
      dateOfBirth: this.calculateDateOfBirth(babyData.age),
      gender: undefined, // Could be added to form
      organizationId: organizationId,
      assignedCoachId: coachId,
      parentIds: [],
      status: 'active',
      createdAt: Timestamp.now(),
      createdBy: coachId,
      lastUpdatedAt: Timestamp.now(),
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
      familyName: babyData.familyName,
      age: babyData.age,
      motherName: babyData.motherName,
      fatherName: babyData.fatherName,
      siblingsCount: babyData.siblingsCount,
      siblingsNames: babyData.siblingsNames,
      description: babyData.description,
      parentUsername: babyData.parentUsername || babyRef.id,
      coachNotes: babyData.coachNotes,
        isArchived: false,
        dateArchived: null,
      lastModified: new Date().toISOString(),
      inviteCode: babyData.inviteCode || ''
    };

    await setDoc(babyRef, babyProfile);

    // Update coach's managed baby profiles
    await this.addBabyToCoachProfile(coachId, babyRef.id);

    // Log audit event
    await AuditLogger.log({
      action: 'baby_profile_created',
      userId: coachId,
      targetType: 'baby_profile',
      targetId: babyRef.id,
      details: {
        babyName: babyData.name,
            familyName: babyData.familyName,
        organizationId: organizationId
      }
    });

    return babyRef.id;
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
        orderBy('familyName'),
        orderBy('name')
      );
    } else if (currentUser.role === 'coach') {
      // Coaches can see their assigned baby profiles
      queryRef = query(
        collection(db, 'baby_profiles'),
        where('assignedCoachId', '==', userId),
        where('status', '!=', 'archived'),
        orderBy('status'),
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

    // Log data access
    await AuditLogger.logDataAccess({
      userId: currentUser.uid,
      targetType: 'baby_profile',
      targetId: 'multiple',
      action: 'read',
      dataScope: currentUser.role,
      recordCount: babyProfiles.length
    });

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
      await AuditLogger.log({
        action: 'unauthorized_access_attempt',
        userId: userId,
        targetType: 'baby_profile',
        targetId: babyId,
        details: {
          reason: 'insufficient_permissions'
        },
        success: false
      });
      
      throw new Error('Access denied to this baby profile');
    }

    // Log data access
    await AuditLogger.logDataAccess({
      userId: userId,
      targetType: 'baby_profile',
      targetId: babyId,
      action: 'read'
    });

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

    // Log data modification
    await AuditLogger.logDataModification({
      userId: userId,
      action: 'baby_profile_updated',
      targetType: 'baby_profile',
      targetId: babyId,
      previousValues,
      newValues: { ...babyProfile, ...updateData }
    });
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
    await AuditLogger.log({
      action: 'baby_profile_archived',
      userId: userId,
      targetType: 'baby_profile',
      targetId: babyId,
      details: {
        reason: 'manual_archive'
      }
    });
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
    await AuditLogger.log({
      action: 'baby_profile_restored',
      userId: userId,
      targetType: 'baby_profile',
      targetId: babyId,
      details: {
        reason: 'manual_restore'
      }
    });
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
    await AuditLogger.log({
      action: 'parent_added_to_baby',
      userId: userId,
      targetType: 'baby_profile',
      targetId: babyId,
      targetUserId: parentId,
      details: {
        addedBy: userId
      }
    });
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
    await AuditLogger.log({
      action: 'parent_removed_from_baby',
      userId: userId,
      targetType: 'baby_profile',
      targetId: babyId,
      targetUserId: parentId,
      details: {
        removedBy: userId
      }
    });
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
    await AuditLogger.log({
      action: 'baby_profile_transferred',
      userId: userId,
      targetType: 'baby_profile',
      targetId: babyId,
      details: {
        previousCoachId,
        newCoachId,
        transferredBy: userId
      }
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

    // Log data access
    await AuditLogger.logDataAccess({
      userId: userId,
      targetType: 'sleep_log',
      targetId: babyId,
      action: 'read',
      recordCount: sleepRecords.length
    });

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

    await AuditLogger.logDataModification({
      userId: currentUser.uid,
      action: 'sleep_log_updated',
      targetType: 'sleep_log',
      targetId: recordId,
      previousValues,
      newValues: { ...(previousValues || {}), ...(updates as any) }
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

    await AuditLogger.log({
      action: 'sleep_log_deleted',
      userId: currentUser.uid,
      targetType: 'sleep_log',
      targetId: recordId,
      details: { babyId }
    });
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
      id: sleepRecordRef.id,
      timestamp: Timestamp.now()
    };

    await setDoc(sleepRecordRef, sleepRecordWithId);

    // Update baby profile last modified
    await updateDoc(doc(db, 'baby_profiles', babyId), {
      lastUpdatedAt: Timestamp.now(),
      lastModified: new Date().toISOString()
    });

    // Log data creation
    await AuditLogger.log({
      action: 'sleep_log_created',
      userId: userId,
      targetType: 'sleep_log',
      targetId: sleepRecordRef.id,
      details: {
          babyId,
        date: sleepRecord.date,
        cycleCount: sleepRecord.sleepCycles.length
      }
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

