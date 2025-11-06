#!/usr/bin/env python3
"""
Simple HTTP proxy server for Highway API
Run this on the laptop where Python requests works
Usage: python3 scripts/highway-proxy-server.py
"""

from flask import Flask, request, jsonify
import requests
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv('.env.local')

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

API_BASE = "https://staging.highway.com/core/connect/external_api/v1"

def get_api_key():
    api_key = os.getenv('HIGHWAY_API_KEY')
    if not api_key:
        raise ValueError("HIGHWAY_API_KEY not found in .env.local")
    return api_key.replace(" ", "").replace("\n", "").replace("\r", "")

@app.route('/proxy/carrier/<mc_number>', methods=['GET'])
def get_carrier_by_mc(mc_number):
    """Proxy endpoint to get carrier by MC number"""
    try:
        api_key = get_api_key()
        
        # Try the by_identifier endpoint
        url = f"{API_BASE}/carriers/MC/{mc_number}/by_identifier"
        
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'User-Agent': 'HighwayScorecard/1.7',
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        return jsonify({
            'status': response.status_code,
            'data': response.json() if response.status_code == 200 else response.text,
            'headers': dict(response.headers)
        }), response.status_code
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/proxy/carrier-detail/<carrier_id>', methods=['GET'])
def get_carrier_detail(carrier_id):
    """Proxy endpoint to get carrier detail by ID"""
    try:
        api_key = get_api_key()
        
        url = f"{API_BASE}/carriers/{carrier_id}"
        
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'User-Agent': 'HighwayScorecard/1.7',
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        return jsonify({
            'status': response.status_code,
            'data': response.json() if response.status_code == 200 else response.text,
            'headers': dict(response.headers)
        }), response.status_code
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Highway API proxy server is running'})

if __name__ == '__main__':
    print("🚀 Starting Highway API Proxy Server...")
    print("📍 Endpoints:")
    print("   GET /proxy/carrier/<mc_number> - Get carrier by MC number")
    print("   GET /proxy/carrier-detail/<carrier_id> - Get carrier detail")
    print("   GET /health - Health check")
    print("\n⚠️  Make sure this server is accessible from your Next.js app")
    print("   Run with: python3 scripts/highway-proxy-server.py")
    print("   Or with Flask: FLASK_APP=scripts/highway-proxy-server.py flask run --host=0.0.0.0 --port=5001")
    app.run(host='0.0.0.0', port=5001, debug=True)

