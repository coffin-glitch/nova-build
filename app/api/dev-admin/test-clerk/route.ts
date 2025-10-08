import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    
    console.log("🧪 Testing Clerk API connection...");
    console.log("🔑 Clerk Secret Key exists:", !!clerkSecretKey);
    
    if (!clerkSecretKey) {
      return NextResponse.json({
        success: false,
        error: "CLERK_SECRET_KEY not found in environment variables"
      });
    }
    
    // Test basic Clerk API connection - try multiple endpoints
    let testResponse;
    let apiVersion = 'v1';
    let endpoint = 'users';
    
    console.log("🔑 Testing Clerk Secret Key format:", clerkSecretKey.startsWith('sk_') ? 'Valid (sk_)' : 'Invalid');
    console.log("🔑 Clerk Secret Key length:", clerkSecretKey.length);
    
    // Try different combinations
    const endpoints = [
      { version: 'v1', path: 'users' },
      { version: 'v0', path: 'users' },
      { version: 'v1', path: 'users?limit=5' },
      { version: 'v0', path: 'users?limit=5' }
    ];
    
    for (const ep of endpoints) {
      try {
        const url = `https://api.clerk.com/${ep.version}/${ep.path}`;
        console.log(`📡 Trying: ${url}`);
        
        testResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${clerkSecretKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`📊 Response status: ${testResponse.status}`);
        
        if (testResponse.ok) {
          apiVersion = ep.version;
          endpoint = ep.path;
          console.log(`✅ Success with ${ep.version}/${ep.path}`);
          break;
        } else {
          const errorText = await testResponse.text();
          console.log(`❌ Failed with ${ep.version}/${ep.path}: ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Network error with ${ep.version}/${ep.path}:`, error);
      }
    }
    
    console.log("📊 Test Response Status:", testResponse.status);
    console.log("📊 Test Response OK:", testResponse.ok);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error("❌ Clerk API Test Error:", errorText);
      return NextResponse.json({
        success: false,
        error: `Clerk API error: ${testResponse.status}`,
        details: errorText
      });
    }
    
    const testData = await testResponse.json();
    console.log("📋 Test Response Data:", JSON.stringify(testData, null, 2));
    
    // Handle both response formats
    let users;
    if (Array.isArray(testData)) {
      users = testData;
      console.log("📊 Using direct array format");
    } else if (testData.data && Array.isArray(testData.data)) {
      users = testData.data;
      console.log("📊 Using data property format");
    } else {
      users = [];
      console.log("⚠️ Unknown response format");
    }
    
    return NextResponse.json({
      success: true,
      message: `Clerk API connection successful (${apiVersion}/${endpoint})`,
      apiVersion: apiVersion,
      endpoint: endpoint,
      userCount: users.length,
      users: users.map((user: any) => ({
        id: user.id,
        email: user.email_addresses?.[0]?.email_address,
        firstName: user.first_name,
        lastName: user.last_name
      }))
    });
    
  } catch (error: any) {
    console.error("❌ Clerk API Test Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}
