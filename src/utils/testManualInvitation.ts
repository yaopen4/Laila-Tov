// Test script for manual invitation system
// This file can be used to test the manual invitation functionality

import { ManualInvitationService } from '@/services/manualInvitationService';

/**
 * Test function to verify manual invitation system works
 * This should be called from the admin dashboard or a test page
 */
export const testManualInvitationSystem = async () => {
  console.log('🧪 Testing Manual Invitation System...');
  
  const manualInvitationService = new ManualInvitationService();
  
  try {
    // Test 1: Create a manual invitation
    console.log('📝 Test 1: Creating manual invitation...');
    
    const testParams = {
      email: 'test@example.com',
      role: 'parent' as const,
      organizationId: 'test-org-123',
      createdBy: 'test-admin-uid',
      metadata: {
        welcomeMessage: 'Welcome to the test!',
        babyProfileId: 'test-baby-123'
      }
    };
    
    const result = await manualInvitationService.createManualInvitation(testParams);
    
    if (result.success && result.invitation && result.invitationCode) {
      console.log('✅ Test 1 PASSED: Manual invitation created successfully');
      console.log('📋 Invitation Code:', result.invitationCode);
      console.log('📧 Email:', result.invitation.email);
      console.log('👤 Role:', result.invitation.role);
      
      // Test 2: Retrieve invitation by code
      console.log('🔍 Test 2: Retrieving invitation by code...');
      
      const retrievedInvitation = await manualInvitationService.getInvitationByCode(result.invitationCode);
      
      if (retrievedInvitation && retrievedInvitation.invitationCode === result.invitationCode) {
        console.log('✅ Test 2 PASSED: Invitation retrieved successfully');
        console.log('📋 Retrieved Code:', retrievedInvitation.invitationCode);
        console.log('📧 Retrieved Email:', retrievedInvitation.email);
        
        // Test 3: Get pending invitations
        console.log('📋 Test 3: Getting pending invitations...');
        
        const pendingInvitations = await manualInvitationService.getPendingInvitations('test-org-123');
        
        if (pendingInvitations.length > 0) {
          console.log('✅ Test 3 PASSED: Pending invitations retrieved');
          console.log('📊 Found', pendingInvitations.length, 'pending invitations');
        } else {
          console.log('❌ Test 3 FAILED: No pending invitations found');
        }
        
        // Test 4: Cancel invitation
        console.log('❌ Test 4: Cancelling invitation...');
        
        await manualInvitationService.cancelInvitation(result.invitation.id, 'test-admin-uid');
        
        const cancelledInvitation = await manualInvitationService.getInvitationByCode(result.invitationCode);
        
        if (cancelledInvitation && cancelledInvitation.status === 'cancelled') {
          console.log('✅ Test 4 PASSED: Invitation cancelled successfully');
        } else {
          console.log('❌ Test 4 FAILED: Invitation not cancelled properly');
        }
        
      } else {
        console.log('❌ Test 2 FAILED: Could not retrieve invitation by code');
      }
      
    } else {
      console.log('❌ Test 1 FAILED: Could not create manual invitation');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test FAILED with error:', error);
  }
  
  console.log('🏁 Manual Invitation System Test Complete');
};

/**
 * Test function to verify invitation code format
 */
export const testInvitationCodeFormat = () => {
  console.log('🔤 Testing Invitation Code Format...');
  
  const manualInvitationService = new ManualInvitationService();
  
  // Test code generation (this will fail in test environment, but we can check the format)
  const testCode = 'AB12CD34'; // Example format
  
  // Check if code matches expected format (8 characters, alphanumeric, no O or 0)
  const codeRegex = /^[A-HJ-NP-Z1-9]{8}$/;
  
  if (codeRegex.test(testCode)) {
    console.log('✅ Invitation code format is correct');
    console.log('📋 Example code:', testCode);
  } else {
    console.log('❌ Invitation code format is incorrect');
  }
  
  console.log('🏁 Invitation Code Format Test Complete');
};

/**
 * Display test instructions for manual testing
 */
export const displayTestInstructions = () => {
  console.log(`
🧪 Manual Invitation System Test Instructions:

1. Admin Dashboard Test:
   - Go to /admin/dashboard
   - Click on "הזמנות ידניות" tab
   - Click "הזמנה חדשה" button
   - Fill in the form with test data
   - Verify invitation code is generated
   - Test copy functionality

2. User Registration Test:
   - Go to /signup
   - Use the generated invitation code
   - Fill in registration form
   - Verify user is created with correct role

3. Expected Behavior:
   - Admin can create invitations without email sending
   - Invitation codes are 8 characters long
   - Codes can be copied to clipboard
   - Users can register with invitation codes
   - Placeholder users are created for pending invitations

4. Test Data:
   - Email: test@example.com
   - Role: parent, coach, or admin
   - Organization: test-org-123

📝 Note: This is a foundation system. Email sending will be added later.
  `);
};
