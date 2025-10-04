# CTV Ad Server

A scalable Connected TV (CTV) advertising platform designed to handle real-time ad serving, campaign management, and analytics for streaming television platforms.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Go** 1.21+
- **Docker** and Docker Compose
- **Git**

### One-Time Setup
```bash
# 1. Clone the repository
git clone <repository-url>
cd ad-server

# 2. Run automated setup (installs dependencies, starts infrastructure, runs migrations)
npm run setup
```

This command will:
- Install all Node.js and Go dependencies
- Start Docker services (PostgreSQL, Redis, LocalStack, etc.)
- Run database migrations
- Seed development data
- Initialize S3 buckets in LocalStack

### Starting Services

**Option 1: Start Infrastructure Only (Recommended for development)**
```bash
# Start infrastructure services (PostgreSQL, Redis, etc.)
docker-compose -f docker-compose.dev.yml up -d

# In separate terminals, start each application service:

# Terminal 1: API Gateway
cd services/api-gateway
npm run dev

# Terminal 2: Dashboard
cd dashboard
npm run dev

# Terminal 3: Go Ad Server
cd services/ad-server
PORT=8888 make run
# Or: PORT=8888 go run cmd/server/main.go

# Terminal 4: Redis Sync Service (optional, runs every 5 minutes automatically)
cd services/redis-sync
npm run dev
```

**Option 2: Quick Start (Infrastructure + API Gateway)**
```bash
# Starts infrastructure and API Gateway only
npm run dev
```

**Option 3: Start Everything with Docker Compose**
```bash
# Start all infrastructure services
docker-compose -f docker-compose.dev.yml up -d

# Then manually start application services as needed (see Option 1)
```

### Available Services

| Service | URL | Port | Started By | Description |
|---------|-----|------|------------|-------------|
| **Application Services** |
| Dashboard | http://localhost:3001 | 3001 | Manual | Campaign management UI (Next.js) |
| API Gateway | http://localhost:3000 | 3000 | `npm run dev` | REST API endpoints (Node.js) |
| Ad Server | http://localhost:8888 | 8888* | Manual | Real-time ad serving (Go) |
| Redis Sync | - | - | Manual | PostgreSQL→Redis sync service |
| **Infrastructure Services** |
| PostgreSQL | localhost:5432 | 5432 | Docker | Database (user: adserver, db: adserver_dev) |
| Redis | localhost:6379 | 6379 | Docker | Cache and session store |
| LocalStack | http://localhost:4566 | 4566 | Docker | AWS services simulation (S3) |
| pgAdmin | http://localhost:8080 | 8080 | Docker | Database management UI |
| RedisInsight | http://localhost:8081 | 8081 | Docker | Redis management UI |

*Go Ad Server port is configurable via `PORT` environment variable (default: 8080, recommended: 8888 to avoid conflict with pgAdmin)

### Service Health Checks
```bash
# API Gateway
curl http://localhost:3000/health

# Ad Server (Go)
curl http://localhost:8888/health

# Dashboard
curl http://localhost:3001
```

### Test Environment Services

For running tests, a separate test infrastructure is available:

```bash
# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# Test services run on different ports to avoid conflicts:
# - PostgreSQL Test: localhost:5433
# - Redis Test: localhost:6380
# - LocalStack Test: localhost:4567

# Run all tests
./scripts/test-all.sh test

# Stop test infrastructure
docker-compose -f docker-compose.test.yml down
```

**Note:** Tests automatically use the test infrastructure. No need to manually switch configurations.

## 🧪 Test Accounts

All test accounts use password: `password123`

- **admin@adserver.dev** (admin role)
- **advertiser@adserver.dev** (advertiser role)
- **viewer@adserver.dev** (viewer role)

## 🏗️ System Architecture

### Current Implementation (MVP Complete)
```
┌──────────────────────────────────────────────────────────┐
│                     Client Layer                          │
│  ┌──────────────┐          ┌──────────────────┐         │
│  │  Dashboard   │          │   CTV Devices    │         │
│  │ (Next.js UI) │          │  (Ad Requests)   │         │
│  └──────────────┘          └──────────────────┘         │
└──────────┬────────────────────────┬─────────────────────┘
           │                        │
           ▼                        ▼
    ┌─────────────┐          ┌─────────────┐
    │ API Gateway │          │  Ad Server  │
    │  (Node.js)  │◄────────►│    (Go)     │
    │  Port 3000  │          │  Port 8888  │
    └─────────────┘          └─────────────┘
           │                        │
    ┌──────┴────────┐        ┌──────┴───────┐
    ▼               ▼        ▼              ▼
┌──────────┐  ┌─────────┐ ┌──────┐    ┌──────┐
│PostgreSQL│  │  Redis  │ │Redis │    │  S3  │
│Campaigns │  │Sessions │ │Cache │    │Video │
│Creatives │  │ Tokens  │ │AdData│    │Files │
│Users     │  │         │ │      │    │      │
└──────────┘  └─────────┘ └──────┘    └──────┘
```

### Key Features

#### ✅ API Gateway (Node.js)
- JWT authentication and authorization
- Campaign CRUD operations
- Creative upload to S3 (LocalStack)
- User management
- PostgreSQL data persistence
- Redis session management
- Rate limiting and security headers
- >97% test coverage (220+ tests)

#### ✅ Ad Server (Go)
- High-performance ad serving (<5ms response)
- Real-time campaign eligibility checks
- Creative selection from Redis cache
- Impression tracking
- Budget and date validation
- 13 integration tests with real Redis

#### ✅ Dashboard (Next.js 15)
- Campaign management interface
- Creative upload with drag-and-drop
- Form validation with Zod
- Real-time API integration
- 20 E2E tests with Playwright

#### ✅ Redis Sync Service (Node.js)
- Syncs PostgreSQL campaigns to Redis
- Keeps ad server cache hot
- Runs every 5 minutes
- Automatic on campaign changes

## 📖 API Documentation

### Authentication Endpoints

#### Register User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "User Name"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "advertiser@adserver.dev",
    "password": "password123"
  }'
```

### Campaign Endpoints

#### Create Campaign
```bash
curl -X POST http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Sale Campaign",
    "description": "Q3 promotional campaign",
    "budget_total": 10000,
    "start_date": "2025-07-01",
    "end_date": "2025-09-30"
  }'
```

#### List Campaigns
```bash
curl -X GET http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Get Campaign Stats
```bash
curl -X GET http://localhost:3000/api/v1/campaigns/{id}/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Creative Endpoints

#### Upload Creative
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/{id}/creatives \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "name=Summer Ad 30s" \
  -F "file=@video.mp4"
```

### Ad Serving Endpoints (Go Server)

#### Request Ad
```bash
curl -X POST http://localhost:8888/api/v1/ad-request \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "roku-device-123",
    "device_type": "ctv",
    "app_id": "streaming-app-456"
  }'
```

#### Track Impression
```bash
curl -X POST http://localhost:8888/api/v1/impression \
  -H "Content-Type: application/json" \
  -d '{
    "ad_id": "ad-uuid",
    "campaign_id": "campaign-uuid",
    "creative_id": "creative-uuid",
    "device_id": "roku-device-123",
    "device_type": "ctv",
    "completed": true,
    "duration": 30
  }'
```

## 🛠️ Development Commands

```bash
# Environment Management
npm run setup          # Complete development environment setup
npm run dev            # Start all services (Dashboard + API + Go server)
npm run clean          # Stop and remove all containers

# Database Operations
npm run db:migrate     # Run pending database migrations
npm run db:seed        # Seed development data
npm run db:reset       # Reset database (drop, create, migrate, seed)

# Testing
./scripts/test-all.sh test              # Run all tests (all services)
./scripts/test-all.sh service api-gateway  # Test specific service
./scripts/test-all.sh service ad-server    # Test Go ad server
./scripts/test-all.sh service dashboard    # Test dashboard E2E
./scripts/test-all.sh coverage          # Generate coverage reports

# Individual Service Tests
cd services/api-gateway && npm test     # API Gateway tests
cd services/ad-server && make test      # Go ad server tests
cd dashboard && npm run test:e2e        # Dashboard E2E tests

# Code Quality
npm run lint           # Check code style with ESLint
npm run lint:fix       # Auto-fix code style issues
```

## 🧪 Testing

### Test Coverage Summary
- **Total Tests**: 250+ across all services
- **API Gateway**: 220+ tests, >97% coverage (Jest)
- **Ad Server (Go)**: 13 integration tests (real Redis)
- **Dashboard**: 20 E2E tests (Playwright)

### Test Philosophy
- ✅ **Real dependencies** - No mocks for integration tests
- ✅ **Isolated test environment** - Separate Redis/PostgreSQL on different ports
- ✅ **Comprehensive coverage** - Unit, integration, E2E, security tests
- ✅ **CI/CD ready** - GitHub Actions pipeline

For detailed testing information, see [TESTING.md](TESTING.md)

## 🔒 Security Features

- **JWT Authentication** with access (24h) and refresh tokens (7d)
- **Password Security** with bcrypt hashing (12 rounds)
- **Token Blacklisting** using Redis for logout/refresh
- **Rate Limiting** (100 requests per 15 minutes per IP)
- **Input Validation** with Joi/Zod schemas
- **Security Headers** via Helmet.js
- **CORS Configuration** for cross-origin requests
- **File Upload Validation** (type, size limits)
- **SQL Injection Protection** via parameterized queries

## 📊 Current Features

### ✅ Implemented (MVP Complete)

#### Campaign Management
- Full CRUD operations for campaigns
- Budget tracking and management
- Date range validation
- Status management (active, paused, completed)
- Real-time sync to Redis cache

#### Creative Management
- Video creative upload to S3
- File validation (MP4, MOV, 100MB max)
- Metadata extraction (duration, format)
- Association with campaigns
- S3 storage via LocalStack

#### Ad Serving
- Real-time ad selection (<5ms)
- Campaign eligibility filtering (dates, budget, status)
- Creative rotation
- Impression tracking
- Redis-based caching

#### User Management
- User registration and authentication
- Role-based access control (admin, advertiser, viewer)
- JWT token management
- Profile management

#### Dashboard UI
- Campaign creation and management
- Creative upload interface
- Drag-and-drop file upload
- Form validation
- Real-time data updates

#### Analytics & Tracking
- Impression tracking
- Campaign statistics
- Daily aggregation
- Budget spend tracking

#### Infrastructure
- Docker Compose development environment
- Database migrations (knex.js)
- Redis caching layer
- S3 integration (LocalStack)
- Health monitoring
- Request logging

### 📋 Planned Features (Future Phases)

#### Phase 2 - Analytics Dashboard
- Real-time campaign performance metrics
- Impression/click visualization
- Budget utilization charts
- Date range filtering
- Creative performance breakdown

#### Phase 3 - AWS Deployment
- ECS/EKS deployment
- RDS for PostgreSQL
- ElastiCache for Redis
- S3 for video storage
- CloudFront CDN
- Application Load Balancer
- Auto-scaling policies

#### Phase 4 - Advanced Features
- VAST 4.x tag generation
- Frequency capping
- Competitive separation
- Audience targeting
- A/B testing framework
- Real-time bidding support

## 🐳 Docker Services

### Development Environment (docker-compose.dev.yml)
- **PostgreSQL 15** - Primary database
- **Redis 7** - Session store and cache
- **pgAdmin 4** - Database management
- **RedisInsight** - Redis monitoring
- **LocalStack** - AWS S3 simulation

### Test Environment (docker-compose.test.yml)
- **PostgreSQL Test** (port 5433)
- **Redis Test** (port 6380)
- **LocalStack Test** (port 4567)

## 📁 Project Structure

```
ad-server/
├── services/
│   ├── api-gateway/              # Node.js REST API
│   │   ├── src/
│   │   │   ├── middleware/       # Auth, validation, logging
│   │   │   ├── routes/           # API endpoints
│   │   │   ├── services/         # Business logic
│   │   │   └── utils/            # Utilities
│   │   └── tests/                # 220+ tests
│   ├── ad-server/                # Go ad serving engine
│   │   ├── cmd/server/           # Main entry point
│   │   ├── internal/
│   │   │   ├── handlers/         # HTTP handlers
│   │   │   ├── services/         # Ad selection logic
│   │   │   ├── models/           # Data models
│   │   │   └── redis/            # Redis client
│   │   └── Makefile              # Build commands
│   └── redis-sync/               # PostgreSQL → Redis sync
├── dashboard/                     # Next.js 15 admin UI
│   ├── app/                      # App router pages
│   ├── components/               # React components
│   └── tests/e2e/                # Playwright tests
├── shared/
│   └── database/
│       ├── migrations/           # Database migrations
│       └── seeds/                # Seed data
├── scripts/                      # Automation scripts
│   ├── test-all.sh              # Run all tests
│   ├── test-docker.sh           # Docker test runner
│   └── dev.sh                   # Development startup
└── docs/                         # Documentation
```

## 🔍 Monitoring & Debugging

### Health Checks
```bash
# API Gateway health
curl http://localhost:3000/health

# Ad Server health
curl http://localhost:8080/health
```

### Logs
```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api-gateway
docker-compose -f docker-compose.dev.yml logs -f ad-server
docker-compose -f docker-compose.dev.yml logs -f redis-sync
```

### Database Access
```bash
# PostgreSQL CLI
docker-compose -f docker-compose.dev.yml exec postgres psql -U adserver -d adserver_dev

# Redis CLI
docker-compose -f docker-compose.dev.yml exec redis redis-cli

# View campaigns in Redis
docker-compose -f docker-compose.dev.yml exec redis redis-cli ZRANGE active_campaigns 0 -1
```

## 🚨 Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   npm run clean  # Stop all containers
   npm run setup  # Restart everything
   ```

2. **Database connection errors**
   ```bash
   # Check PostgreSQL
   docker-compose -f docker-compose.dev.yml ps postgres
   docker-compose -f docker-compose.dev.yml logs postgres
   ```

3. **Redis sync not working**
   ```bash
   # Check sync service logs
   docker-compose -f docker-compose.dev.yml logs redis-sync

   # Manually trigger sync
   docker-compose -f docker-compose.dev.yml restart redis-sync
   ```

4. **Port conflicts**
   - Dashboard: 3001
   - API Gateway: 3000
   - Ad Server: 8888 (configurable via PORT env var)
   - PostgreSQL: 5432
   - Redis: 6379
   - pgAdmin: 8080
   - RedisInsight: 8081
   - LocalStack: 4566

   **Note:** Default Ad Server port is 8080, but we use 8888 to avoid conflicts with pgAdmin

### Reset Everything
```bash
npm run clean              # Stop all containers
docker system prune -a     # Clean up Docker resources
npm run setup              # Restart from scratch
```

## 📈 Performance Benchmarks

### Current Performance (Local Development)
- **Ad serving**: ~2-5ms average response time
- **API Gateway auth**: ~150ms (includes bcrypt)
- **Campaign queries**: ~10-20ms
- **Health checks**: ~5ms
- **Redis cache**: <1ms lookups

### Database Stats
- **Campaigns**: Full CRUD with indexes
- **Creatives**: S3 URLs with metadata
- **Impressions**: Daily aggregation
- **Users**: Bcrypt password hashing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `./scripts/test-all.sh test`
5. Ensure coverage: `./scripts/test-all.sh coverage`
6. Commit: `git commit -m 'Add amazing feature'`
7. Push: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📚 Additional Documentation

- [PROGRESS.md](PROGRESS.md) - Development progress and milestones
- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [TECH_STACK.md](TECH_STACK.md) - Technology decisions and rationale

For detailed technical specifications and architecture decisions, see the docs in each service directory.
