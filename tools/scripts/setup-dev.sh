#!/bin/bash
set -e

echo "🚀 Setting up CTV Ad Server development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install Node.js 18+"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Please install Docker"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Please install Docker Compose"; exit 1; }

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file - please review and update as needed"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true

# Start infrastructure services
echo "🐳 Starting infrastructure services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U adserver -d adserver_dev >/dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping >/dev/null 2>&1; do
    echo "   Waiting for Redis..."
    sleep 2
done
echo "✅ Redis is ready"

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Seed development data
echo "🌱 Seeding development data..."
npm run db:seed || echo "⚠️ Seeding failed - this might be normal if data already exists"

# Create logs directory for API Gateway
mkdir -p services/api-gateway/logs

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Available services:"
echo "   • API Gateway: http://localhost:3000"
echo "   • PostgreSQL: localhost:5432 (user: adserver, db: adserver_dev)"
echo "   • Redis: localhost:6379"
echo "   • pgAdmin: http://localhost:8080 (admin@adserver.dev / admin)"
echo "   • RedisInsight: http://localhost:8081"
echo "   • LocalStack: http://localhost:4566"
echo ""
echo "🚀 To start the API Gateway:"
echo "   npm run dev"
echo ""
echo "🧪 Test accounts (password: password123):"
echo "   • admin@adserver.dev (admin)"
echo "   • advertiser@adserver.dev (advertiser)"
echo "   • viewer@adserver.dev (viewer)"
echo ""
echo "🛑 To stop all services:"
echo "   npm run clean"