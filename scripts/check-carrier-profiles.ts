import sql from '../lib/db';

async function checkCarrierProfiles() {
  try {
    console.log('Checking carrier profiles...');
    
    const profiles = await sql`
      SELECT 
        id,
        clerk_user_id,
        company_name,
        mc_number,
        contact_name,
        phone,
        profile_status,
        submitted_at,
        reviewed_at,
        reviewed_by,
        review_notes,
        decline_reason,
        is_first_login,
        profile_completed_at,
        edits_enabled,
        created_at,
        updated_at
      FROM carrier_profiles
      ORDER BY created_at DESC
    `;

    console.log(`Found ${profiles.length} carrier profiles:`);
    profiles.forEach((profile, index) => {
      console.log(`\n${index + 1}. Profile ID: ${profile.id}`);
      console.log(`   Clerk User ID: ${profile.clerk_user_id}`);
      console.log(`   Company: ${profile.company_name}`);
      console.log(`   MC Number: ${profile.mc_number}`);
      console.log(`   Contact: ${profile.contact_name}`);
      console.log(`   Phone: ${profile.phone}`);
      console.log(`   Profile Status: ${profile.profile_status}`);
      console.log(`   Submitted At: ${profile.submitted_at}`);
      console.log(`   Reviewed At: ${profile.reviewed_at}`);
      console.log(`   Is First Login: ${profile.is_first_login}`);
      console.log(`   Profile Completed At: ${profile.profile_completed_at}`);
      console.log(`   Edits Enabled: ${profile.edits_enabled}`);
      console.log(`   Created At: ${profile.created_at}`);
    });

  } catch (error) {
    console.error('Error checking carrier profiles:', error);
  } finally {
    await sql.end();
  }
}

checkCarrierProfiles();
