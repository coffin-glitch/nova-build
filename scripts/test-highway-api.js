#!/usr/bin/env node

/**
 * Test script for Highway API
 * Usage: node scripts/test-highway-api.js <MC_NUMBER>
 * Example: node scripts/test-highway-api.js 203507
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const API_BASE = "https://staging.highway.com/core/connect/external_api/v1";

function getApiKey() {
  const apiKey = process.env.HIGHWAY_API_KEY;
  if (!apiKey) {
    console.error('❌ ERROR: HIGHWAY_API_KEY not found in .env.local');
    process.exit(1);
  }
  return apiKey.replace(/\s/g, "");
}

async function makeRequest(url, method = 'GET') {
  // Match Python requests exactly - Python uses title-case Accept
  const headers = {
    'Accept': 'application/json',  // Python requests uses title-case
    'Authorization': `Bearer ${getApiKey()}`,
    'User-Agent': 'HighwayScorecard/1.7',
  };

  console.log('\n📡 Making request:');
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${method}`);
  const displayHeaders = { ...headers };
  displayHeaders.Authorization = 'Bearer [REDACTED]';
  console.log(`   Headers:`, JSON.stringify(displayHeaders, null, 2));

  try {
    const response = await axios({
      method: method.toLowerCase(),
      url: url,
      headers: headers,
      validateStatus: (status) => true, // Don't throw on any status
      maxRedirects: 5,
      timeout: 30000,
    });

    return {
      statusCode: response.status,
      statusMessage: response.statusText || '',
      data: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      headers: response.headers,
    };
  } catch (error) {
    if (error.response) {
      return {
        statusCode: error.response.status,
        statusMessage: error.response.statusText || '',
        data: typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data),
        headers: error.response.headers,
      };
    }
    throw error;
  }
}

async function testMCNumber(mcNumber) {
  console.log(`\n🧪 Testing Highway API with MC Number: ${mcNumber}\n`);
  console.log('='.repeat(60));

  // Test 1: Try by_identifier endpoint
  console.log('\n📋 Test 1: Testing /carriers/MC/{mc}/by_identifier');
  try {
    const url1 = `${API_BASE}/carriers/MC/${mcNumber}/by_identifier`;
    const response1 = await makeRequest(url1);
    
    console.log(`\n✅ Response Status: ${response1.statusCode} ${response1.statusMessage}`);
    console.log(`📦 Response Headers:`, JSON.stringify(response1.headers, null, 2));
    
    if (response1.statusCode === 200) {
      try {
        const data = JSON.parse(response1.data);
        console.log(`\n✅ SUCCESS! Carrier found:`);
        console.log(JSON.stringify(data, null, 2));
        return { success: true, data };
      } catch (e) {
        console.log(`\n⚠️  Response is not JSON:`);
        console.log(response1.data.substring(0, 500));
      }
    } else if (response1.statusCode === 401) {
      console.log(`\n❌ 401 UNAUTHORIZED`);
      console.log(`Response:`, response1.data);
      console.log(`\n💡 This means:`);
      console.log(`   - The API key is being rejected by Highway`);
      console.log(`   - Possible causes:`);
      console.log(`     1. IP restriction (your IP is not whitelisted)`);
      console.log(`     2. API key is invalid or expired`);
      console.log(`     3. API key is for wrong environment (staging vs production)`);
      return { success: false, error: '401 Unauthorized', response: response1.data };
    } else {
      console.log(`\n⚠️  Unexpected status: ${response1.statusCode}`);
      console.log(`Response:`, response1.data.substring(0, 500));
      return { success: false, error: `Status ${response1.statusCode}`, response: response1.data };
    }
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testCarrierDetail(carrierId) {
  console.log(`\n📋 Test 2: Testing /carriers/{id} with carrier ID: ${carrierId}`);
  try {
    const url = `${API_BASE}/carriers/${carrierId}`;
    const response = await makeRequest(url);
    
    console.log(`\n✅ Response Status: ${response.statusCode} ${response.statusMessage}`);
    
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.data);
        console.log(`\n✅ SUCCESS! Carrier detail retrieved`);
        console.log(`Carrier ID: ${data.id || 'N/A'}`);
        console.log(`Carrier Name: ${data.name || 'N/A'}`);
        return { success: true, data };
      } catch (e) {
        console.log(`\n⚠️  Response is not JSON:`);
        console.log(response.data.substring(0, 500));
      }
    } else {
      console.log(`\n⚠️  Status: ${response.statusCode}`);
      console.log(`Response:`, response.data.substring(0, 500));
    }
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
  }
}

async function main() {
  const mcNumber = process.argv[2] || '203507';
  
  console.log('\n🚀 Highway API Test Script');
  console.log('='.repeat(60));
  console.log(`\n🔑 API Key Status: ${process.env.HIGHWAY_API_KEY ? '✅ Found' : '❌ Not Found'}`);
  
  if (!process.env.HIGHWAY_API_KEY) {
    console.error('\n❌ Please set HIGHWAY_API_KEY in your .env.local file');
    process.exit(1);
  }
  
  const apiKey = getApiKey();
  console.log(`🔑 API Key Length: ${apiKey.length} characters`);
  console.log(`🔑 API Key Preview: ${apiKey.substring(0, 30)}...`);
  
  // Test MC lookup
  const result = await testMCNumber(mcNumber);
  
  // If successful, test carrier detail
  if (result.success && result.data && result.data.id) {
    await testCarrierDetail(result.data.id);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test Complete!\n');
  
  if (!result.success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});

