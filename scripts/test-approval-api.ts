import sql from '../lib/db';

async function testApprovalAPI() {
  try {
    console.log('Testing approval API with actual user IDs...');
    
    // Get the first carrier profile
    const profiles = await sql`
      SELECT 
        id,
        clerk_user_id,
        company_name,
        profile_status
      FROM carrier_profiles
      WHERE profile_status = 'pending'
      LIMIT 1
    `;

    if (profiles.length === 0) {
      console.log('No pending profiles found');
      return;
    }

    const profile = profiles[0];
    console.log(`Testing with profile:`, profile);

    // Test the API endpoint URL construction
    const apiUrl = `/api/admin/carriers/${profile.clerk_user_id}/approve`;
    console.log(`API URL would be: ${apiUrl}`);

    // Check if the user_id is valid
    if (!profile.clerk_user_id) {
      console.log('ERROR: clerk_user_id is null or undefined');
      return;
    }

    console.log(`User ID is valid: ${profile.clerk_user_id}`);

  } catch (error) {
    console.error('Error testing approval API:', error);
  } finally {
    await sql.end();
  }
}

testApprovalAPI();
