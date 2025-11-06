#!/usr/bin/env python3
"""
Test script for Highway API using Python requests
Usage: python3 scripts/test-highway-api.py <MC_NUMBER>
Example: python3 scripts/test-highway-api.py 203507
"""

import os
import sys
import json
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv('.env.local')

API_BASE = "https://staging.highway.com/core/connect/external_api/v1"

def get_api_key():
    api_key = os.getenv('HIGHWAY_API_KEY')
    if not api_key:
        print("❌ ERROR: HIGHWAY_API_KEY not found in .env.local")
        sys.exit(1)
    # Remove any whitespace
    return api_key.replace(" ", "").replace("\n", "").replace("\r", "")

def test_mc_number(mc_number):
    print(f"\n🧪 Testing Highway API with MC Number: {mc_number}\n")
    print("=" * 60)
    
    api_key = get_api_key()
    
    print(f"\n🔑 API Key Status: ✅ Found")
    print(f"🔑 API Key Length: {len(api_key)} characters")
    print(f"🔑 API Key Preview: {api_key[:30]}...")
    
    # Test 1: Try by_identifier endpoint
    print("\n📋 Test 1: Testing /carriers/MC/{mc}/by_identifier")
    
    url = f"{API_BASE}/carriers/MC/{mc_number}/by_identifier"
    
    headers = {
        'accept': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'User-Agent': 'HighwayScorecard/1.7',
    }
    
    print(f"\n📡 Making request:")
    print(f"   URL: {url}")
    print(f"   Method: GET")
    display_headers = headers.copy()
    display_headers['Authorization'] = 'Bearer [REDACTED]'
    print(f"   Headers: {json.dumps(display_headers, indent=2)}")
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"\n✅ Response Status: {response.status_code} {response.reason}")
        print(f"📦 Response Headers: {json.dumps(dict(response.headers), indent=2)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"\n✅ SUCCESS! Carrier found:")
                print(json.dumps(data, indent=2))
                return {'success': True, 'data': data}
            except:
                print(f"\n⚠️  Response is not JSON:")
                print(response.text[:500])
        elif response.status_code == 401:
            print(f"\n❌ 401 UNAUTHORIZED")
            print(f"Response: {response.text}")
            print(f"\n💡 This means:")
            print(f"   - The API key is being rejected by Highway")
            print(f"   - Possible causes:")
            print(f"     1. IP restriction (your IP is not whitelisted)")
            print(f"     2. API key is invalid or expired")
            print(f"     3. API key is for wrong environment (staging vs production)")
            return {'success': False, 'error': '401 Unauthorized', 'response': response.text}
        else:
            print(f"\n⚠️  Unexpected status: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return {'success': False, 'error': f'Status {response.status_code}', 'response': response.text}
    except Exception as error:
        print(f"\n❌ Error: {str(error)}")
        return {'success': False, 'error': str(error)}

def main():
    mc_number = sys.argv[1] if len(sys.argv) > 1 else '203507'
    
    print('\n🚀 Highway API Test Script (Python)')
    print('=' * 60)
    
    result = test_mc_number(mc_number)
    
    print('\n' + '=' * 60)
    print('\n✅ Test Complete!\n')
    
    if not result.get('success'):
        sys.exit(1)

if __name__ == '__main__':
    main()

