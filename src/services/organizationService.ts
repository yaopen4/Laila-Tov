// Organization Management Service
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
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Organization } from '@/types/auth';
import { AuthService } from './authService';
import { RoleService } from './roleService';

export class OrganizationService {
  
  /**
   * Create a new organization
   */
  static async createOrganization(params: {
    name: string;
    type: 'clinic' | 'independent' | 'enterprise';
    ownerId: string;
    settings?: Partial<Organization['settings']>;
    branding?: Organization['branding'];
  }): Promise<string> {
    // Verify admin access
    await AuthService.ensureAdminAccess();
    
    const orgRef = doc(collection(db, 'organizations'));
    
    const organization: Organization = {
      id: orgRef.id,
      name: params.name,
      type: params.type,
      settings: {
        defaultInvitationExpiry: 7,
        maxCoaches: 100,
        maxBabyProfilesPerCoach: 50,
        allowParentInvitations: true,
        ...params.settings
      },
      branding: params.branding,
      createdAt: Timestamp.now(),
      ownerId: params.ownerId,
      isActive: true
    };
    
    await setDoc(orgRef, organization);
    
    // Initialize system roles for the new organization
    await RoleService.initializeSystemRoles(orgRef.id, params.ownerId);
    
    // Log organization creation
    
    return orgRef.id;
  }
  
  /**
   * Get organization by ID
   */
  static async getOrganization(organizationId: string): Promise<Organization | null> {
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
      
      if (orgDoc.exists()) {
        return orgDoc.data() as Organization;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting organization:', error);
      return null;
    }
  }
  
  /**
   * Get all organizations (admin only)
   */
  static async getAllOrganizations(): Promise<Organization[]> {
    // Ensure caller has admin access via current auth layer
    
    try {
      const orgsQuery = query(
        collection(db, 'organizations'),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const snapshot = await getDocs(orgsQuery);
      return snapshot.docs.map(doc => doc.data() as Organization);
    } catch (error) {
      console.error('Error getting organizations:', error);
      return [];
    }
  }
  
  /**
   * Update organization settings
   */
  static async updateOrganization(
    organizationId: string,
    updates: Partial<Organization>,
    userId: string
  ): Promise<void> {
    // Check if user is admin of this organization
    const currentUser = await AuthService.getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    const org = await this.getOrganization(organizationId);
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    if (org.ownerId !== userId && currentUser.organizationId !== organizationId) {
      throw new Error('Insufficient permissions to update this organization');
    }
    
    const previousValues = { ...org };
    
    await updateDoc(doc(db, 'organizations', organizationId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    // Log organization update
  }
  
  /**
   * Get organization statistics
   */
  static async getOrganizationStats(organizationId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalCoaches: number;
    totalParents: number;
    totalBabyProfiles: number;
    activeBabyProfiles: number;
    pendingInvitations: number;
  }> {
    try {
      // Get users count
      const usersQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', organizationId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => doc.data());
      
      // Get baby profiles count
      const babyProfilesQuery = query(
        collection(db, 'baby_profiles'),
        where('organizationId', '==', organizationId)
      );
      const babyProfilesSnapshot = await getDocs(babyProfilesQuery);
      const babyProfiles = babyProfilesSnapshot.docs.map(doc => doc.data());
      
      // Get pending invitations count
      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('organizationId', '==', organizationId),
        where('status', '==', 'pending')
      );
      const invitationsSnapshot = await getDocs(invitationsQuery);
      
      return {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        totalCoaches: users.filter(u => u.role === 'coach').length,
        totalParents: users.filter(u => u.role === 'parent').length,
        totalBabyProfiles: babyProfiles.length,
        activeBabyProfiles: babyProfiles.filter(b => b.status === 'active').length,
        pendingInvitations: invitationsSnapshot.size
      };
    } catch (error) {
      console.error('Error getting organization stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalCoaches: 0,
        totalParents: 0,
        totalBabyProfiles: 0,
        activeBabyProfiles: 0,
        pendingInvitations: 0
      };
    }
  }
  
  /**
   * Get organization users
   */
  static async getOrganizationUsers(organizationId: string): Promise<any[]> {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', organizationId),
        orderBy('displayName')
      );
      
      const snapshot = await getDocs(usersQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting organization users:', error);
      return [];
    }
  }
  
  /**
   * Get organization invitations
   */
  static async getOrganizationInvitations(organizationId: string): Promise<any[]> {
    try {
      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(invitationsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting organization invitations:', error);
      return [];
    }
  }
  
  /**
   * Deactivate organization
   */
  static async deactivateOrganization(
    organizationId: string,
    userId: string
  ): Promise<void> {
    await AuthService.ensureAdminAccess();
    
    const org = await this.getOrganization(organizationId);
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    await updateDoc(doc(db, 'organizations', organizationId), {
      isActive: false,
      deactivatedAt: Timestamp.now(),
      deactivatedBy: userId
    });
    
    // Log deactivation
  }
}
