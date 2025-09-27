# CTV Ad Server

A scalable Connected TV (CTV) advertising platform designed to handle real-time ad serving, campaign management, and analytics for streaming television platforms.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Docker** and Docker Compose
- **Git**

### Setup & Run
```bash
# 1. Clone the repository
git clone <repository-url>
cd ad-server

# 2. Run automated setup (installs dependencies, starts services, runs migrations)
npm run setup

# 3. Start the API Gateway
npm run dev
```

The API Gateway will be available at: **http://localhost:3000**

## 📋 Available Services

| Service | URL | Description |
|---------|-----|-------------|
| API Gateway | http://localhost:3000 | Main API endpoints |
| Health Check | http://localhost:3000/health | System health status |
| pgAdmin | http://localhost:8080 | Database management UI |
| RedisInsight | http://localhost:8081 | Redis management UI |
| PostgreSQL | localhost:5432 | Database (user: adserver, db: adserver_dev) |
| Redis | localhost:6379 | Cache and session store |
| LocalStack | http://localhost:4566 | AWS services simulation |

## 🧪 Test Accounts

All test accounts use password: `password123`

- **admin@adserver.dev** (admin role)
- **advertiser@adserver.dev** (advertiser role)
- **viewer@adserver.dev** (viewer role)

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

#### Get Profile (Protected)
```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Campaign Endpoints (Mock Data)

#### List Campaigns
```bash
curl -X GET http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Get Campaign Details
```bash
curl -X GET http://localhost:3000/api/v1/campaigns/campaign-id \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🏗️ Architecture

### Current Implementation (Step 1)
```
┌─────────────────┐
│   Client Apps   │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   API Gateway   │
│   (Port 3000)   │
│                 │
│ • Authentication│
│ • Rate Limiting │
│ • Request Log   │
│ • Validation    │
└─────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────┐
│PostgreSQL│ │  Redis  │
│ Users    │ │ Sessions│
│ (5432)   │ │ (6379)  │
└─────────┘ └─────────┘
```

### Planned Full Architecture
```
Internet → ALB → EKS Cluster
                 ├── API Gateway
                 ├── Campaign Service
                 ├── Ad Decision Engine
                 └── Tracking Service
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   PostgreSQL      Redis        ClickHouse
   (Campaigns)   (Caching)     (Analytics)
```

## 🛠️ Development Commands

```bash
# Environment Management
npm run setup          # Complete development environment setup
npm run dev            # Start API Gateway with hot reload
npm run clean          # Stop and remove all containers

# Database Operations
npm run db:migrate     # Run pending database migrations
npm run db:seed        # Seed development data
npm run db:reset       # Reset database (drop, create, migrate, seed)

# Testing (when implemented)
npm test               # Run all tests
npm run test:unit      # Run unit tests only
npm run test:integration  # Run integration tests
npm run test:load      # Run load tests with k6

# Code Quality
npm run lint           # Check code style with ESLint
npm run lint:fix       # Auto-fix code style issues
```

## 🔒 Security Features

- **JWT Authentication** with access (24h) and refresh tokens (7d)
- **Password Security** with bcrypt hashing (12 rounds)
- **Token Blacklisting** using Redis for logout/refresh
- **Rate Limiting** (100 requests per 15 minutes per IP)
- **Input Validation** with Joi schemas
- **Security Headers** via Helmet.js
- **CORS Configuration** for cross-origin requests

## 📊 Current Features

### ✅ Implemented
- **User Authentication** (register, login, logout, refresh)
- **Role-based Access Control** (admin, advertiser, viewer)
- **API Gateway** with middleware pipeline
- **Health Monitoring** with dependency checks
- **Request Logging** with unique request IDs
- **Database Migrations** with PostgreSQL
- **Development Environment** with Docker Compose

### 🚧 In Development
- Campaign management (CRUD operations)
- Creative upload and validation
- Targeting rule configuration
- Comprehensive testing suite

### 📋 Planned (Future Phases)
- Ad decision engine with real-time selection
- VAST 4.x tag generation
- Frequency capping and competitive separation
- Analytics and reporting dashboard
- AWS cloud deployment
- Load balancing and auto-scaling

## 🐳 Docker Services

The development environment includes:

- **PostgreSQL 15** - Primary database with UUID support
- **Redis 7** - Session store and caching layer
- **pgAdmin 4** - Database management interface
- **RedisInsight** - Redis monitoring and management
- **LocalStack** - AWS services simulation (S3, Lambda, etc.)

All services include health checks and automatic restart policies.

## 📁 Project Structure

```
ad-server/
├── services/
│   └── api-gateway/           # Express.js API Gateway
│       ├── src/
│       │   ├── middleware/    # Auth, validation, logging
│       │   ├── routes/        # API route handlers
│       │   ├── services/      # Business logic services
│       │   └── utils/         # Utility functions
│       └── tests/             # Service-specific tests
├── shared/
│   └── database/              # Database schemas and migrations
├── infrastructure/            # Terraform and K8s configs (planned)
├── tools/
│   └── scripts/               # Development and deployment scripts
└── docs/                      # Project documentation
```

## 🔍 Monitoring & Debugging

### Health Check
```bash
curl http://localhost:3000/health
```

Returns system status including:
- Overall service health
- PostgreSQL connection status
- Redis connection status
- Response latencies

### Logs
- **API Gateway logs**: Structured JSON logs with Winston
- **Database logs**: Available via pgAdmin
- **Redis logs**: Available via RedisInsight
- **Container logs**: `docker-compose logs -f [service]`

### Database Access
```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres psql -U adserver -d adserver_dev

# Connect to Redis
docker-compose -f docker-compose.dev.yml exec redis redis-cli
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
   # Check if PostgreSQL is running
   docker-compose -f docker-compose.dev.yml ps postgres

   # View PostgreSQL logs
   docker-compose -f docker-compose.dev.yml logs postgres
   ```

3. **Port conflicts**
   - PostgreSQL: 5432
   - Redis: 6379
   - API Gateway: 3000
   - pgAdmin: 8080
   - RedisInsight: 8081
   - LocalStack: 4566

### Reset Everything
```bash
npm run clean          # Stop all containers
docker system prune    # Clean up Docker resources
npm run setup          # Restart from scratch
```

## 📈 Performance

### Current Benchmarks (Local Development)
- **Health check**: ~5ms
- **User registration**: ~150ms (includes bcrypt hashing)
- **User login**: ~140ms (includes bcrypt verification)
- **Protected routes**: ~10ms (with valid JWT)
- **Database queries**: ~3-8ms

### Production Targets (Phase 1 Complete)
- **Ad serving response**: <100ms (95th percentile)
- **API response times**: <50ms (excluding auth operations)
- **Concurrent users**: 1000+ simultaneous connections
- **Throughput**: 10,000+ requests/second

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

For detailed development progress and technical specifications, see [PROGRESS.md](PROGRESS.md) and [PHASE_1_DETAILED_PLAN.md](PHASE_1_DETAILED_PLAN.md).