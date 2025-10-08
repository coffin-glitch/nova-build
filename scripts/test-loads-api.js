#!/usr/bin/env node

/**
 * Test script for loads API endpoints
 */

const baseUrl = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Loads API endpoints...\n');

  try {
    // Test 1: GET loads
    console.log('1️⃣ Testing GET /api/loads...');
    const loadsResponse = await fetch(`${baseUrl}/api/loads?limit=5`);
    if (loadsResponse.ok) {
      const loadsData = await loadsResponse.json();
      console.log(`✅ GET loads successful - Found ${loadsData.loads?.length || 0} loads`);
      
      if (loadsData.loads && loadsData.loads.length > 0) {
        const testLoad = loadsData.loads[0];
        console.log(`📦 Test load: ${testLoad.rr_number} (${testLoad.status_code})`);
        
        // Test 2: PATCH individual load
        console.log('\n2️⃣ Testing PATCH /api/loads/[rrNumber]...');
        const updateResponse = await fetch(`${baseUrl}/api/loads/${testLoad.rr_number}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' })
        });
        
        if (updateResponse.ok) {
          const updateData = await updateResponse.json();
          console.log(`✅ PATCH load successful - ${updateData.message || 'Updated'}`);
        } else {
          const errorData = await updateResponse.json().catch(() => ({}));
          console.log(`❌ PATCH load failed: ${errorData.error || updateResponse.status}`);
        }

        // Test 3: POST bulk operations
        console.log('\n3️⃣ Testing POST /api/loads (bulk operations)...');
        const bulkResponse = await fetch(`${baseUrl}/api/loads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'archive',
            rrNumbers: [testLoad.rr_number]
          })
        });
        
        if (bulkResponse.ok) {
          const bulkData = await bulkResponse.json();
          console.log(`✅ Bulk operation successful - ${bulkData.message || 'Completed'}`);
        } else {
          const errorData = await bulkResponse.json().catch(() => ({}));
          console.log(`❌ Bulk operation failed: ${errorData.error || bulkResponse.status}`);
        }

        // Test 4: POST export
        console.log('\n4️⃣ Testing POST /api/loads/export...');
        const exportResponse = await fetch(`${baseUrl}/api/loads/export?format=csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: {},
            rrNumbers: [testLoad.rr_number]
          })
        });
        
        if (exportResponse.ok) {
          console.log(`✅ Export successful - Content-Type: ${exportResponse.headers.get('content-type')}`);
        } else {
          const errorData = await exportResponse.json().catch(() => ({}));
          console.log(`❌ Export failed: ${errorData.error || exportResponse.status}`);
        }
      } else {
        console.log('⚠️ No loads found to test with');
      }
    } else {
      console.log(`❌ GET loads failed: ${loadsResponse.status}`);
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }

  console.log('\n🏁 API testing complete');
}

// Run the test
testAPI();
