#!/bin/bash
set -e

# Load environment variables from root .env file
set -a
source .env
set +a

echo "🧪 Testing Impression Tracking End-to-End"
echo ""

# 1. Request an ad
echo "1. Requesting ad from Go server..."
AD_RESPONSE=$(curl -s -X POST http://localhost:8888/api/v1/ad-request \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device-123",
    "device_type": "ctv",
    "app_id": "test-app-456"
  }')

echo "Ad Response: $AD_RESPONSE"
echo ""

# Extract IDs from response
AD_ID=$(echo $AD_RESPONSE | jq -r '.ad_id')
CAMPAIGN_ID=$(echo $AD_RESPONSE | jq -r '.campaign_id')
CREATIVE_ID=$(echo $AD_RESPONSE | jq -r '.creative_id')

echo "Ad ID: $AD_ID"
echo "Campaign ID: $CAMPAIGN_ID"
echo "Creative ID: $CREATIVE_ID"
echo ""

# 2. Track impression
echo "2. Tracking impression..."
IMPRESSION_RESPONSE=$(curl -s -X POST http://localhost:8888/api/v1/impression \
  -H "Content-Type: application/json" \
  -d "{
    \"ad_id\": \"$AD_ID\",
    \"campaign_id\": \"$CAMPAIGN_ID\",
    \"creative_id\": \"$CREATIVE_ID\",
    \"device_id\": \"test-device-123\",
    \"device_type\": \"ctv\",
    \"ip_address\": \"192.168.1.100\"
  }")

echo "Impression Response: $IMPRESSION_RESPONSE"
echo ""

# 3. Wait for batch flush (6 seconds to be safe)
echo "3. Waiting 6 seconds for batch flush..."
sleep 6

# 4. Query PostgreSQL to verify impression was saved
echo "4. Checking PostgreSQL for impression..."
psql $DATABASE_URL -c "SELECT id, campaign_id, creative_id, served_at FROM impressions WHERE campaign_id = '$CAMPAIGN_ID' ORDER BY served_at DESC LIMIT 5;"

echo ""
echo "5. Checking campaign daily stats..."
psql $DATABASE_URL -c "SELECT campaign_id, date, impressions_count FROM campaign_daily_stats WHERE campaign_id = '$CAMPAIGN_ID';"

echo ""
echo "✅ Test complete!"
