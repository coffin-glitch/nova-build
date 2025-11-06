#!/bin/bash

# Test Highway API using curl (closest to raw HTTP)
# Usage: ./scripts/test-highway-direct-curl.sh <MC_NUMBER>

source .env.local

MC_NUMBER=${1:-203507}
API_KEY="$HIGHWAY_API_KEY"

if [ -z "$API_KEY" ]; then
  echo "❌ ERROR: HIGHWAY_API_KEY not found in .env.local"
  exit 1
fi

# Remove any whitespace from key
API_KEY=$(echo "$API_KEY" | tr -d '[:space:]')

echo "🧪 Testing Highway API with MC Number: $MC_NUMBER"
echo "============================================================"
echo ""
echo "📡 Making request with curl (raw HTTP):"
echo "   URL: https://staging.highway.com/core/connect/external_api/v1/carriers/MC/$MC_NUMBER/by_identifier"
echo ""

# Test with curl - this is the most basic HTTP client
response=$(curl -s -w "\n%{http_code}" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "User-Agent: HighwayScorecard/1.7" \
  "https://staging.highway.com/core/connect/external_api/v1/carriers/MC/$MC_NUMBER/by_identifier")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "✅ HTTP Status Code: $http_code"
echo ""
echo "📦 Response Body:"
echo "$body" | head -20

if [ "$http_code" = "200" ]; then
  echo ""
  echo "✅ SUCCESS! API key works with curl"
  exit 0
elif [ "$http_code" = "401" ]; then
  echo ""
  echo "❌ 401 UNAUTHORIZED"
  echo "The API key is being rejected even with raw curl"
  exit 1
else
  echo ""
  echo "⚠️  Unexpected status: $http_code"
  exit 1
fi

