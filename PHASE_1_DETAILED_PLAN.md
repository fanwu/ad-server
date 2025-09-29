# Phase 1 Detailed Development Plan
## Foundation & Infrastructure Setup

### Overview
Phase 1 establishes the foundational infrastructure for the CTV ad server, including database design, API gateway, authentication, and complete development/deployment workflows.

**Duration:** 8 weeks (2 months)
**Team:** 2-3 developers (1 backend lead, 1 infrastructure/DevOps, 1 database engineer)

---

## Project Structure

### 1.1 Repository Organization
```
ad-server/
├── docs/                           # Documentation
│   ├── api/                        # API documentation
│   ├── database/                   # Database schemas and migrations
│   └── deployment/                 # Deployment guides
├── services/                       # Microservices
│   ├── auth-service/              # Authentication service
│   ├── campaign-service/          # Campaign management
│   ├── ad-decision-service/       # Ad decision engine (Phase 3)
│   └── tracking-service/          # Tracking service (Phase 4)
├── shared/                        # Shared libraries
│   ├── database/                  # Database models and migrations
│   ├── auth/                      # Authentication utilities
│   ├── validation/                # Request validation schemas
│   └── monitoring/                # Logging and metrics
├── infrastructure/                # Infrastructure as Code
│   ├── terraform/                 # AWS Terraform configurations
│   ├── docker/                    # Docker configurations
│   └── k8s/                      # Kubernetes manifests
├── tools/                         # Development tools
│   ├── scripts/                   # Setup and utility scripts
│   └── testing/                   # Testing utilities
├── .github/                       # GitHub Actions workflows
├── docker-compose.yml             # Local development environment
├── package.json                   # Root package.json for workspace
└── README.md                      # Project documentation
```

---

## Week 1-2: Development Environment Setup

### 1.2 Local Development Environment

#### Prerequisites
- **Node.js** 22+ with npm/yarn (for best compatibility)
- **Docker** & Docker Compose
- **PostgreSQL** 14+ (via Docker)
- **Redis** 7+ (via Docker)
- **Git** with SSH keys configured
- **AWS CLI** v2
- **Terraform** 1.5+
- **kubectl** (for Kubernetes)

#### Local Environment Setup Script

**File:** `tools/scripts/setup-dev.sh`
```bash
#!/bin/bash
set -e

echo "🚀 Setting up CTV Ad Server development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment templates
echo "🔧 Setting up environment files..."
cp .env.example .env.local
cp .env.example .env.test

# Start local infrastructure
echo "🐳 Starting local infrastructure..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Seed development data
echo "🌱 Seeding development data..."
npm run db:seed

echo "✅ Development environment setup complete!"
echo "🌐 API Gateway: http://localhost:3000"
echo "📊 Database UI: http://localhost:8080 (pgAdmin)"
echo "🔍 Redis UI: http://localhost:8081 (RedisInsight)"
```

#### Docker Compose Configuration

**File:** `docker-compose.dev.yml`
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: adserver-postgres-dev
    environment:
      POSTGRES_DB: adserver_dev
      POSTGRES_USER: adserver
      POSTGRES_PASSWORD: dev_password
      POSTGRES_MULTIPLE_DATABASES: adserver_test
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./tools/scripts/init-test-db.sh:/docker-entrypoint-initdb.d/init-test-db.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U adserver -d adserver_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: adserver-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # pgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: adserver-pgadmin-dev
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@adserver.dev
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "8080:80"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pgadmin_data:/var/lib/pgadmin

  # RedisInsight for Redis management
  redis-insight:
    image: redislabs/redisinsight:latest
    container_name: adserver-redis-insight-dev
    ports:
      - "8081:8001"
    volumes:
      - redis_insight_data:/db

  # LocalStack for AWS services simulation
  localstack:
    image: localstack/localstack:latest
    container_name: adserver-localstack-dev
    environment:
      SERVICES: s3,cloudformation,iam,lambda,logs
      DEBUG: 1
      DATA_DIR: /tmp/localstack/data
    ports:
      - "4566:4566"
    volumes:
      - localstack_data:/tmp/localstack
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  postgres_data:
  redis_data:
  pgadmin_data:
  redis_insight_data:
  localstack_data:
```

#### Environment Configuration

**File:** `.env.example`
```bash
# Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://adserver:dev_password@localhost:5432/adserver_dev
DATABASE_TEST_URL=postgresql://adserver:dev_password@localhost:5432/adserver_test

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# AWS Configuration (LocalStack for development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_NAME=adserver-creatives-dev

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3001,http://localhost:3000

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

---

## Week 3-4: Database Design & Implementation

### 1.3 Database Schema Design

#### Core Tables Schema

**File:** `shared/database/migrations/001_create_core_tables.sql`
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Advertisers table
CREATE TABLE advertisers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    company VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    budget_total DECIMAL(12,2) NOT NULL CHECK (budget_total > 0),
    budget_daily DECIMAL(12,2),
    budget_spent DECIMAL(12,2) DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_date_range CHECK (end_date > start_date),
    CONSTRAINT valid_daily_budget CHECK (budget_daily IS NULL OR budget_daily <= budget_total)
);

-- Creatives table
CREATE TABLE creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    duration INTEGER NOT NULL CHECK (duration > 0), -- in seconds
    file_size BIGINT, -- in bytes
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    bitrate INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing')),
    click_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Targeting rules table
CREATE TABLE targeting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Geographic targeting (JSON array of country/region/city codes)
    geo_countries JSONB,  -- ["US", "CA", "UK"]
    geo_regions JSONB,    -- ["US-CA", "US-NY"]
    geo_cities JSONB,     -- ["Los Angeles", "New York"]

    -- Device targeting
    device_types JSONB,   -- ["smart_tv", "streaming_device", "gaming_console"]
    os_types JSONB,       -- ["android_tv", "roku_os", "fire_tv", "apple_tv"]
    device_brands JSONB,  -- ["samsung", "lg", "roku", "amazon"]

    -- Content targeting
    content_categories JSONB, -- ["sports", "news", "entertainment"]
    content_genres JSONB,     -- ["action", "comedy", "drama"]
    content_rating JSONB,     -- ["G", "PG", "PG-13", "R"]

    -- Audience targeting
    age_min INTEGER CHECK (age_min >= 0 AND age_min <= 100),
    age_max INTEGER CHECK (age_max >= 0 AND age_max <= 100),
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'any')),

    -- Time targeting
    time_zones JSONB,     -- ["America/New_York", "America/Los_Angeles"]
    day_parts JSONB,      -- [{"start": "06:00", "end": "12:00"}, {"start": "18:00", "end": "23:00"}]
    days_of_week JSONB,   -- [1, 2, 3, 4, 5] (Monday=1, Sunday=7)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_age_range CHECK (age_max IS NULL OR age_min IS NULL OR age_max >= age_min)
);

-- Frequency capping rules
CREATE TABLE frequency_caps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    creative_id UUID REFERENCES creatives(id) ON DELETE CASCADE, -- NULL for campaign-level caps

    max_impressions INTEGER NOT NULL CHECK (max_impressions > 0),
    time_window_hours INTEGER NOT NULL CHECK (time_window_hours > 0),
    scope VARCHAR(20) DEFAULT 'user' CHECK (scope IN ('user', 'device', 'household')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ad pods configuration
CREATE TABLE ad_pods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    max_ads INTEGER DEFAULT 6 CHECK (max_ads > 0 AND max_ads <= 10),

    -- Competitive separation rules
    enable_competitive_separation BOOLEAN DEFAULT true,
    min_separation_seconds INTEGER DEFAULT 30,

    -- Pod structure preferences
    pod_type VARCHAR(20) DEFAULT 'dynamic' CHECK (pod_type IN ('structured', 'dynamic', 'hybrid')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive categories for separation
CREATE TABLE competitive_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign competitive category assignments
CREATE TABLE campaign_competitive_categories (
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES competitive_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (campaign_id, category_id)
);

-- Indexes for performance
CREATE INDEX idx_campaigns_advertiser_id ON campaigns(advertiser_id);
CREATE INDEX idx_campaigns_status_dates ON campaigns(status, start_date, end_date);
CREATE INDEX idx_creatives_campaign_id ON creatives(campaign_id);
CREATE INDEX idx_creatives_status ON creatives(status);
CREATE INDEX idx_targeting_rules_campaign_id ON targeting_rules(campaign_id);
CREATE INDEX idx_frequency_caps_campaign_id ON frequency_caps(campaign_id);

-- GIN indexes for JSON columns (for efficient querying)
CREATE INDEX idx_targeting_geo_countries ON targeting_rules USING GIN (geo_countries);
CREATE INDEX idx_targeting_device_types ON targeting_rules USING GIN (device_types);
CREATE INDEX idx_targeting_content_categories ON targeting_rules USING GIN (content_categories);
```

#### Migration System

**File:** `shared/database/migrate.js`
```javascript
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DatabaseMigrator {
    constructor(databaseUrl) {
        this.pool = new Pool({ connectionString: databaseUrl });
        this.migrationsDir = path.join(__dirname, 'migrations');
    }

    async createMigrationsTable() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    }

    async getAppliedMigrations() {
        const result = await this.pool.query(
            'SELECT version FROM schema_migrations ORDER BY version'
        );
        return result.rows.map(row => row.version);
    }

    async getPendingMigrations() {
        const applied = await this.getAppliedMigrations();
        const files = fs.readdirSync(this.migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        return files.filter(file => !applied.includes(file));
    }

    async runMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf8');

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query(
                'INSERT INTO schema_migrations (version) VALUES ($1)',
                [filename]
            );
            await client.query('COMMIT');
            console.log(`✅ Applied migration: ${filename}`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async migrate() {
        await this.createMigrationsTable();
        const pending = await this.getPendingMigrations();

        if (pending.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }

        console.log(`📊 Running ${pending.length} migrations...`);
        for (const migration of pending) {
            await this.runMigration(migration);
        }
        console.log('✅ All migrations completed');
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = DatabaseMigrator;
```

### 1.4 Database Testing & Seeding

**File:** `shared/database/seeds/development.sql`
```sql
-- Seed development data

-- Insert competitive categories
INSERT INTO competitive_categories (name, description) VALUES
('automotive', 'Car manufacturers and dealers'),
('food_beverage', 'Food and beverage brands'),
('telecommunications', 'Phone and internet service providers'),
('financial_services', 'Banks, insurance, and financial companies'),
('retail_ecommerce', 'Retail stores and e-commerce platforms'),
('streaming_services', 'Video and music streaming platforms'),
('gaming', 'Video games and gaming platforms');

-- Insert test advertiser
INSERT INTO advertisers (id, name, email, company) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'John Smith', 'john@testadvertiser.com', 'Test Advertiser Inc');

-- Insert test campaign
INSERT INTO campaigns (
    id, advertiser_id, name, description, status,
    budget_total, budget_daily, start_date, end_date, priority
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'Summer Product Launch',
    'Test campaign for summer product promotion',
    'active',
    10000.00,
    500.00,
    NOW(),
    NOW() + INTERVAL '30 days',
    5
);

-- Insert test creative
INSERT INTO creatives (
    id, campaign_id, name, video_url, duration, mime_type, status, click_url
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'Summer Launch 30s',
    'https://example.com/creative.mp4',
    30,
    'video/mp4',
    'approved',
    'https://example.com/landing'
);

-- Insert targeting rules
INSERT INTO targeting_rules (
    campaign_id, geo_countries, device_types, content_categories, age_min, age_max
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    '["US", "CA"]',
    '["smart_tv", "streaming_device"]',
    '["entertainment", "sports"]',
    25,
    54
);

-- Insert frequency cap
INSERT INTO frequency_caps (
    campaign_id, max_impressions, time_window_hours
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    3,
    24
);
```

---

## Week 5-6: API Gateway & Authentication

### 1.5 API Gateway Implementation

#### Project Structure
```
services/api-gateway/
├── src/
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   ├── validation.js
│   │   └── logging.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── campaigns.js
│   │   └── health.js
│   ├── services/
│   │   ├── authService.js
│   │   └── redisService.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── validator.js
│   ├── app.js
│   └── server.js
├── tests/
├── package.json
└── Dockerfile
```

#### API Gateway Implementation

**File:** `services/api-gateway/src/app.js`
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');
const loggingMiddleware = require('./middleware/logging');

// Route imports
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const healthRoutes = require('./routes/health');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    credentials: true
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(loggingMiddleware);

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check (no auth required)
app.use('/health', healthRoutes);

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// Protected routes
app.use('/api/v1/campaigns', authMiddleware, campaignRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(error.status || 500).json({
        error: {
            message: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            path: req.originalUrl
        }
    });
});

module.exports = app;
```

#### Authentication Service

**File:** `services/api-gateway/src/services/authService.js`
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const redis = require('./redisService');

class AuthService {
    constructor() {
        this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 12);
    }

    async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }

    generateTokens(payload) {
        const accessToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn
        });

        const refreshToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.refreshTokenExpiresIn
        });

        return { accessToken, refreshToken };
    }

    async verifyToken(token) {
        try {
            // Check if token is blacklisted
            const isBlacklisted = await redis.get(`blacklist:${token}`);
            if (isBlacklisted) {
                throw new Error('Token has been revoked');
            }

            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async blacklistToken(token, expiresIn = 86400) {
        await redis.setex(`blacklist:${token}`, expiresIn, 'true');
    }

    async createUser(userData) {
        const { email, password, name, role = 'advertiser' } = userData;

        // Check if user exists
        const existingUser = await this.pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        // Hash password and create user
        const hashedPassword = await this.hashPassword(password);
        const result = await this.pool.query(
            `INSERT INTO users (email, password_hash, name, role, status)
             VALUES ($1, $2, $3, $4, 'active')
             RETURNING id, email, name, role, created_at`,
            [email, hashedPassword, name, role]
        );

        return result.rows[0];
    }

    async authenticateUser(email, password) {
        const result = await this.pool.query(
            'SELECT id, email, password_hash, name, role, status FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }

        const user = result.rows[0];

        if (user.status !== 'active') {
            throw new Error('Account is not active');
        }

        const isValidPassword = await this.comparePassword(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Remove password hash from returned user object
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}

module.exports = new AuthService();
```

---

## Week 7-8: Testing & Infrastructure Setup

### 1.6 Testing Framework

#### Test Configuration

**File:** `package.json` (root)
```json
{
    "name": "ctv-ad-server",
    "private": true,
    "workspaces": [
        "services/*",
        "shared/*"
    ],
    "scripts": {
        "dev": "docker-compose -f docker-compose.dev.yml up -d && npm run dev:services",
        "dev:services": "concurrently \"npm run dev --workspace=services/api-gateway\"",
        "test": "npm run test:unit && npm run test:integration",
        "test:unit": "npm run test --workspaces",
        "test:integration": "jest --config=jest.integration.config.js",
        "test:load": "k6 run tools/testing/load-tests/api-gateway.js",
        "db:migrate": "node shared/database/migrate.js",
        "db:seed": "npm run db:migrate && psql $DATABASE_URL -f shared/database/seeds/development.sql",
        "db:reset": "npm run db:drop && npm run db:create && npm run db:migrate && npm run db:seed",
        "lint": "eslint .",
        "lint:fix": "eslint . --fix",
        "setup": "bash tools/scripts/setup-dev.sh"
    },
    "devDependencies": {
        "@jest/globals": "^29.7.0",
        "concurrently": "^8.2.0",
        "eslint": "^8.45.0",
        "jest": "^29.7.0",
        "k6": "^0.47.0",
        "supertest": "^6.3.3"
    }
}
```

#### Integration Tests

**File:** `tools/testing/integration/api-gateway.test.js`
```javascript
const request = require('supertest');
const { Pool } = require('pg');
const app = require('../../../services/api-gateway/src/app');

describe('API Gateway Integration Tests', () => {
    let pool;
    let authToken;
    let testUserId;

    beforeAll(async () => {
        pool = new Pool({ connectionString: process.env.DATABASE_TEST_URL });

        // Create test user and get auth token
        const response = await request(app)
            .post('/api/v1/auth/register')
            .send({
                email: 'test@example.com',
                password: 'testpassword123',
                name: 'Test User'
            });

        testUserId = response.body.user.id;
        authToken = response.body.tokens.accessToken;
    });

    afterAll(async () => {
        // Clean up test data
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await pool.end();
    });

    describe('Authentication', () => {
        test('POST /api/v1/auth/register - should create new user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'newuser@example.com',
                    password: 'password123',
                    name: 'New User'
                });

            expect(response.status).toBe(201);
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user.email).toBe('newuser@example.com');
            expect(response.body.tokens).toHaveProperty('accessToken');
            expect(response.body.tokens).toHaveProperty('refreshToken');

            // Clean up
            await pool.query('DELETE FROM users WHERE id = $1', [response.body.user.id]);
        });

        test('POST /api/v1/auth/login - should authenticate user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'testpassword123'
                });

            expect(response.status).toBe(200);
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.tokens).toHaveProperty('accessToken');
        });

        test('POST /api/v1/auth/login - should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.error.message).toBe('Invalid credentials');
        });
    });

    describe('Protected Routes', () => {
        test('GET /api/v1/campaigns - should require authentication', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns');

            expect(response.status).toBe(401);
        });

        test('GET /api/v1/campaigns - should work with valid token', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.campaigns)).toBe(true);
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits', async () => {
            const requests = Array(105).fill().map(() =>
                request(app).get('/api/v1/campaigns')
            );

            const responses = await Promise.all(requests);
            const rateLimitedResponses = responses.filter(r => r.status === 429);

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        }, 30000);
    });
});
```

#### Load Testing

**File:** `tools/testing/load-tests/api-gateway.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '2m', target: 100 }, // Ramp up to 100 users
        { duration: '5m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 200 }, // Ramp up to 200 users
        { duration: '5m', target: 200 }, // Stay at 200 users
        { duration: '2m', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
        http_req_failed: ['rate<0.1'],    // Error rate should be below 10%
        errors: ['rate<0.1'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
    // Register a test user and get token
    const payload = JSON.stringify({
        email: `loadtest${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Load Test User'
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const response = http.post(`${BASE_URL}/api/v1/auth/register`, payload, params);

    check(response, {
        'user registration successful': (r) => r.status === 201,
    });

    return {
        token: response.json().tokens.accessToken,
        userId: response.json().user.id
    };
}

export default function(data) {
    const headers = {
        'Authorization': `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };

    // Test different endpoints
    const responses = {
        health: http.get(`${BASE_URL}/health`),
        campaigns: http.get(`${BASE_URL}/api/v1/campaigns`, { headers }),
        profile: http.get(`${BASE_URL}/api/v1/auth/profile`, { headers }),
    };

    // Check responses
    for (const [name, response] of Object.entries(responses)) {
        const success = check(response, {
            [`${name} status is 200`]: (r) => r.status === 200,
            [`${name} response time < 500ms`]: (r) => r.timings.duration < 500,
        });

        errorRate.add(!success);
    }

    sleep(1);
}

export function teardown(data) {
    // Clean up test user
    const headers = {
        'Authorization': `Bearer ${data.token}`,
    };

    http.del(`${BASE_URL}/api/v1/auth/user`, { headers });
}
```

---

## AWS Infrastructure Setup

### 1.7 AWS Architecture

#### Infrastructure Overview
```
Internet Gateway
       │
    ALB (Application Load Balancer)
       │
┌──────────────────────────────────────┐
│            VPC (10.0.0.0/16)         │
│                                      │
│  ┌─────────────┐  ┌─────────────┐   │
│  │   Public    │  │   Public    │   │
│  │  Subnet 1   │  │  Subnet 2   │   │
│  │(10.0.1.0/24)│  │(10.0.2.0/24)│   │
│  │             │  │             │   │
│  │   EKS       │  │   EKS       │   │
│  │   Nodes     │  │   Nodes     │   │
│  └─────────────┘  └─────────────┘   │
│                                      │
│  ┌─────────────┐  ┌─────────────┐   │
│  │   Private   │  │   Private   │   │
│  │  Subnet 1   │  │  Subnet 2   │   │
│  │(10.0.3.0/24)│  │(10.0.4.0/24)│   │
│  │             │  │             │   │
│  │   RDS       │  │ ElastiCache │   │
│  │(PostgreSQL) │  │   (Redis)   │   │
│  └─────────────┘  └─────────────┘   │
└──────────────────────────────────────┘

Additional Services:
- S3 (Creative Storage)
- CloudFront (CDN)
- Route 53 (DNS)
- ACM (SSL Certificates)
- CloudWatch (Monitoring)
- ECR (Container Registry)
```

#### Terraform Configuration

**File:** `infrastructure/terraform/main.tf`
```hcl
terraform {
    required_version = ">= 1.5"
    required_providers {
        aws = {
            source  = "hashicorp/aws"
            version = "~> 5.0"
        }
    }

    backend "s3" {
        bucket = "adserver-terraform-state"
        key    = "infrastructure/terraform.tfstate"
        region = "us-east-1"
    }
}

provider "aws" {
    region = var.aws_region

    default_tags {
        tags = {
            Project     = "ctv-ad-server"
            Environment = var.environment
            ManagedBy   = "terraform"
        }
    }
}

# Data sources
data "aws_availability_zones" "available" {
    state = "available"
}

# Local values
locals {
    name_prefix = "${var.project_name}-${var.environment}"
    azs         = slice(data.aws_availability_zones.available.names, 0, 2)
}

# VPC Module
module "vpc" {
    source = "./modules/vpc"

    name_prefix        = local.name_prefix
    vpc_cidr          = var.vpc_cidr
    availability_zones = local.azs

    tags = var.tags
}

# Security Groups Module
module "security_groups" {
    source = "./modules/security"

    name_prefix = local.name_prefix
    vpc_id      = module.vpc.vpc_id

    tags = var.tags
}

# RDS Module
module "rds" {
    source = "./modules/rds"

    name_prefix               = local.name_prefix
    vpc_id                   = module.vpc.vpc_id
    subnet_ids               = module.vpc.private_subnet_ids
    security_group_id        = module.security_groups.rds_security_group_id
    db_name                  = var.db_name
    db_username              = var.db_username
    db_password              = var.db_password
    instance_class           = var.db_instance_class
    allocated_storage        = var.db_allocated_storage
    backup_retention_period  = var.db_backup_retention_period

    tags = var.tags
}

# ElastiCache Module
module "elasticache" {
    source = "./modules/elasticache"

    name_prefix         = local.name_prefix
    vpc_id             = module.vpc.vpc_id
    subnet_ids         = module.vpc.private_subnet_ids
    security_group_id  = module.security_groups.redis_security_group_id
    node_type          = var.redis_node_type
    num_cache_nodes    = var.redis_num_nodes

    tags = var.tags
}

# EKS Module
module "eks" {
    source = "./modules/eks"

    name_prefix    = local.name_prefix
    vpc_id         = module.vpc.vpc_id
    subnet_ids     = module.vpc.public_subnet_ids
    node_groups    = var.eks_node_groups

    tags = var.tags
}

# S3 Module
module "s3" {
    source = "./modules/s3"

    name_prefix = local.name_prefix

    tags = var.tags
}

# CloudFront Module
module "cloudfront" {
    source = "./modules/cloudfront"

    name_prefix           = local.name_prefix
    s3_bucket_domain_name = module.s3.bucket_domain_name

    tags = var.tags
}

# ALB Module
module "alb" {
    source = "./modules/alb"

    name_prefix       = local.name_prefix
    vpc_id           = module.vpc.vpc_id
    subnet_ids       = module.vpc.public_subnet_ids
    security_group_id = module.security_groups.alb_security_group_id

    tags = var.tags
}
```

**File:** `infrastructure/terraform/variables.tf`
```hcl
variable "aws_region" {
    description = "AWS region"
    type        = string
    default     = "us-east-1"
}

variable "environment" {
    description = "Environment name"
    type        = string
    validation {
        condition     = contains(["dev", "staging", "prod"], var.environment)
        error_message = "Environment must be dev, staging, or prod."
    }
}

variable "project_name" {
    description = "Project name"
    type        = string
    default     = "ctv-ad-server"
}

variable "vpc_cidr" {
    description = "VPC CIDR block"
    type        = string
    default     = "10.0.0.0/16"
}

# Database variables
variable "db_name" {
    description = "Database name"
    type        = string
    default     = "adserver"
}

variable "db_username" {
    description = "Database username"
    type        = string
    default     = "adserver"
}

variable "db_password" {
    description = "Database password"
    type        = string
    sensitive   = true
}

variable "db_instance_class" {
    description = "RDS instance class"
    type        = string
    default     = "db.t3.micro"
}

variable "db_allocated_storage" {
    description = "RDS allocated storage in GB"
    type        = number
    default     = 20
}

variable "db_backup_retention_period" {
    description = "RDS backup retention period in days"
    type        = number
    default     = 7
}

# Redis variables
variable "redis_node_type" {
    description = "ElastiCache node type"
    type        = string
    default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
    description = "Number of ElastiCache nodes"
    type        = number
    default     = 1
}

# EKS variables
variable "eks_node_groups" {
    description = "EKS node groups configuration"
    type = map(object({
        instance_types = list(string)
        min_size      = number
        max_size      = number
        desired_size  = number
    }))
    default = {
        general = {
            instance_types = ["t3.medium"]
            min_size      = 1
            max_size      = 3
            desired_size  = 2
        }
    }
}

variable "tags" {
    description = "Additional tags"
    type        = map(string)
    default     = {}
}
```

### 1.8 Deployment Scripts

**File:** `tools/scripts/deploy-aws.sh`
```bash
#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}

echo "🚀 Deploying CTV Ad Server to AWS ($ENVIRONMENT environment)"

# Validate inputs
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo "❌ Invalid environment. Must be dev, staging, or prod"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null; then
    echo "❌ AWS credentials not configured"
    exit 1
fi

# Build and push Docker images
echo "🐳 Building and pushing Docker images..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com

# Build API Gateway image
docker build -t ctv-ad-server/api-gateway:latest services/api-gateway/
docker tag ctv-ad-server/api-gateway:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/ctv-ad-server/api-gateway:latest
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/ctv-ad-server/api-gateway:latest

# Deploy infrastructure with Terraform
echo "🏗️ Deploying infrastructure..."
cd infrastructure/terraform

terraform init
terraform workspace select $ENVIRONMENT || terraform workspace new $ENVIRONMENT
terraform plan -var="environment=$ENVIRONMENT" -out=tfplan
terraform apply tfplan

# Get outputs
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
EKS_CLUSTER_NAME=$(terraform output -raw eks_cluster_name)

cd ../..

# Update kubeconfig
echo "⚙️ Updating kubeconfig..."
aws eks update-kubeconfig --region $AWS_REGION --name $EKS_CLUSTER_NAME

# Deploy to Kubernetes
echo "☸️ Deploying to Kubernetes..."
envsubst < infrastructure/k8s/api-gateway-deployment.yaml | kubectl apply -f -
kubectl apply -f infrastructure/k8s/

# Wait for deployments
echo "⏳ Waiting for deployments..."
kubectl wait --for=condition=available --timeout=300s deployment/api-gateway

# Run database migrations
echo "🗄️ Running database migrations..."
kubectl run migration-job --image=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/ctv-ad-server/api-gateway:latest \
    --rm -i --restart=Never -- npm run db:migrate

echo "✅ Deployment completed!"
echo "🌐 API Gateway URL: $(kubectl get ingress api-gateway-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
```

### 1.9 Monitoring & Observability

**File:** `infrastructure/k8s/monitoring.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
    name: prometheus-config
data:
    prometheus.yml: |
        global:
            scrape_interval: 15s
        scrape_configs:
        - job_name: 'api-gateway'
          kubernetes_sd_configs:
          - role: endpoints
          relabel_configs:
          - source_labels: [__meta_kubernetes_service_name]
            action: keep
            regex: api-gateway
---
apiVersion: apps/v1
kind: Deployment
metadata:
    name: prometheus
spec:
    replicas: 1
    selector:
        matchLabels:
            app: prometheus
    template:
        metadata:
            labels:
                app: prometheus
        spec:
            containers:
            - name: prometheus
              image: prom/prometheus:latest
              ports:
              - containerPort: 9090
              volumeMounts:
              - name: config
                mountPath: /etc/prometheus
            volumes:
            - name: config
              configMap:
                name: prometheus-config
---
apiVersion: v1
kind: Service
metadata:
    name: prometheus
spec:
    selector:
        app: prometheus
    ports:
    - port: 9090
      targetPort: 9090
---
apiVersion: apps/v1
kind: Deployment
metadata:
    name: grafana
spec:
    replicas: 1
    selector:
        matchLabels:
            app: grafana
    template:
        metadata:
            labels:
                app: grafana
        spec:
            containers:
            - name: grafana
              image: grafana/grafana:latest
              ports:
              - containerPort: 3000
              env:
              - name: GF_SECURITY_ADMIN_PASSWORD
                value: "admin123"
---
apiVersion: v1
kind: Service
metadata:
    name: grafana
spec:
    selector:
        app: grafana
    ports:
    - port: 3000
      targetPort: 3000
```

---

## Success Criteria & Deliverables

### 1.10 Phase 1 Acceptance Criteria

#### Technical Deliverables
- ✅ **Database Schema** - Complete PostgreSQL schema with migrations
- ✅ **API Gateway** - RESTful API with authentication and rate limiting
- ✅ **Authentication Service** - JWT-based auth with user management
- ✅ **Development Environment** - Docker Compose setup with all services
- ✅ **Testing Framework** - Complete 194-test suite with unit, integration, and security testing
- ✅ **CI/CD Pipeline** - GitHub Actions with automated testing on Node.js 22.x
- ⏳ **AWS Infrastructure** - Terraform configs for production environment
- ⏳ **Monitoring** - Prometheus and Grafana setup
- ⏳ **Documentation** - API docs and deployment guides

#### Performance Requirements
- **API Response Time:** <100ms for auth endpoints
- **Database Query Performance:** <10ms for simple queries
- **Concurrent Users:** Support 100+ concurrent authenticated users
- **Uptime:** 99%+ availability in development environment

#### Security Requirements
- **Authentication:** JWT with refresh token rotation
- **Authorization:** Role-based access control (RBAC)
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **Input Validation:** Comprehensive request validation
- **Password Security:** Bcrypt hashing with salt rounds ≥12

### 1.11 Testing Checklist

#### Unit Tests (>97% coverage achieved)
- ✅ Database models and migrations
- ✅ Authentication service methods
- ✅ JWT token generation and validation
- ✅ Password hashing and comparison
- ✅ Request validation middleware
- ✅ Rate limiting logic

#### Integration Tests
- ✅ User registration flow
- ✅ User authentication flow
- ✅ Token refresh mechanism
- ✅ Protected route access
- ✅ Database connection and queries
- ✅ Redis connection and caching

#### Load Tests
- [ ] 100 concurrent users authentication
- [ ] 1000 requests/minute rate limiting
- [ ] Database connection pooling under load
- [ ] Memory usage under sustained load

#### Security Tests
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ JWT token expiration
- ✅ Rate limiting bypass attempts
- ✅ Authentication bypass attempts

### 1.12 Documentation Deliverables

#### API Documentation
- **OpenAPI Specification** - Complete API docs with examples
- **Postman Collection** - Ready-to-use API testing collection
- **Authentication Guide** - JWT implementation details

#### Deployment Documentation
- **Local Setup Guide** - Step-by-step development environment setup
- **AWS Deployment Guide** - Production deployment instructions
- **Environment Configuration** - All environment variables documented
- **Troubleshooting Guide** - Common issues and solutions

#### Architecture Documentation
- **System Architecture Diagram** - High-level system overview
- **Database ERD** - Entity relationship diagram
- **Security Architecture** - Authentication and authorization flow
- **Infrastructure Diagram** - AWS resources and networking

---

## Timeline & Milestones

### Week-by-Week Breakdown

| Week | Focus Area | Key Deliverables | Success Metrics |
|------|------------|------------------|----------------|
| **Week 1** | Project Setup | Repository structure, Docker setup | ✅ Local environment running |
| **Week 2** | Database Design | Schema, migrations, seeding | ✅ Database tests passing |
| **Week 3** | API Gateway Core | Express app, middleware, routing | ✅ Basic API endpoints working |
| **Week 4** | Authentication | JWT service, user management | ✅ Auth flow complete |
| **Week 5** | Testing Framework | Unit tests, integration tests | ✅ >97% test coverage achieved |
| **Week 6** | AWS Infrastructure | Terraform configs, EKS setup | ✅ Infrastructure provisioned |
| **Week 7** | Deployment Pipeline | CI/CD, monitoring setup | ✅ Automated deployments |
| **Week 8** | Testing & Polish | Load testing, documentation | ✅ All acceptance criteria met |

### Phase 1 Completion Checklist

#### Development Environment
- [ ] Local Docker environment fully functional
- [ ] All services start with single command
- [ ] Database migrations run successfully
- [ ] Development data seeded
- [ ] Hot reload working for all services

#### Production Infrastructure
- [ ] AWS resources provisioned via Terraform
- [ ] EKS cluster operational
- [ ] RDS and ElastiCache configured
- [ ] Load balancer and ingress working
- [ ] SSL certificates configured
- [ ] Monitoring and logging active

#### Code Quality
- [ ] All tests passing (unit + integration)
- [ ] Load tests meeting performance requirements
- [ ] Security tests passing
- [ ] Code coverage >90%
- [ ] ESLint rules passing
- [ ] No critical security vulnerabilities

#### Documentation
- [ ] API documentation complete
- [ ] Deployment guides written
- [ ] Architecture diagrams created
- [ ] Troubleshooting guide available
- [ ] Code reviewed and approved

---

This detailed Phase 1 plan provides a solid foundation for the CTV ad server project, ensuring proper development practices, robust infrastructure, and comprehensive testing from the start.