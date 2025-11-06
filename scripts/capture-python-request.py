#!/usr/bin/env python3
"""
Script to capture exact HTTP request details from Python requests
This will help us see exactly what Python sends that works
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv('.env.local')

API_BASE = "https://staging.highway.com/core/connect/external_api/v1"

def get_api_key():
    api_key = os.getenv('HIGHWAY_API_KEY')
    if not api_key:
        print("❌ ERROR: HIGHWAY_API_KEY not found")
        sys.exit(1)
    return api_key.replace(" ", "").replace("\n", "").replace("\r", "")

def test_with_verbose_logging(mc_number):
    """Test with maximum verbosity to see what Python requests sends"""
    api_key = get_api_key()
    
    url = f"{API_BASE}/carriers/MC/{mc_number}/by_identifier"
    
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'User-Agent': 'HighwayScorecard/1.7',
    }
    
    print(f"\n🔍 Python requests library - Exact Request Details:")
    print(f"   URL: {url}")
    print(f"   Method: GET")
    print(f"   Headers:")
    for key, value in headers.items():
        if key == 'Authorization':
            print(f"      {key}: Bearer [REDACTED - {len(api_key)} chars]")
        else:
            print(f"      {key}: {value}")
    
    # Enable requests debug logging
    import logging
    import http.client
    http.client.HTTPConnection.debuglevel = 1
    
    logging.basicConfig()
    logging.getLogger().setLevel(logging.DEBUG)
    requests_log = logging.getLogger("requests.packages.urllib3")
    requests_log.setLevel(logging.DEBUG)
    requests_log.propagate = True
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"\n✅ Response Status: {response.status_code}")
        print(f"📦 Response Headers: {json.dumps(dict(response.headers), indent=2)}")
        print(f"📄 Response Body: {response.text[:500]}")
        
        if response.status_code == 200:
            print(f"\n✅ SUCCESS! Carrier data retrieved")
            return True
        else:
            print(f"\n❌ Failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return False

if __name__ == '__main__':
    mc_number = sys.argv[1] if len(sys.argv) > 1 else '203507'
    test_with_verbose_logging(mc_number)

