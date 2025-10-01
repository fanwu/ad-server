#!/bin/bash
# Initialize S3 bucket for tests in LocalStack

set -e

echo "Waiting for LocalStack to be ready..."
sleep 5

echo "Creating S3 bucket: ${S3_BUCKET_NAME:-ctv-ad-server-creatives}"
aws --endpoint-url="${AWS_ENDPOINT:-http://localhost:4566}" \
    --region="${AWS_REGION:-us-east-1}" \
    s3 mb "s3://${S3_BUCKET_NAME:-ctv-ad-server-creatives}" 2>/dev/null || echo "Bucket already exists or creation failed (ignoring)"

echo "S3 bucket initialization complete"

# Execute the command passed to this script
exec "$@"
