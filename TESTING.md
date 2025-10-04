# CTV Ad Server Testing Guide

This document provides comprehensive information about testing across all services in the CTV Ad Server project.

## Project Testing Structure

```
/
├── .github/workflows/           # CI/CD workflows
│   └── api-gateway-tests.yml   # API Gateway testing pipeline
├── scripts/
│   ├── test-all.sh             # Run all tests across all services
│   └── test-docker.sh          # Docker-based test runner
├── services/
│   ├── api-gateway/
│   │   ├── tests/              # Node.js test files
│   │   └── scripts/test.sh     # Service-specific test script
│   └── ad-server/
│       └── internal/           # Go test files (*_test.go)
├── dashboard/
│   └── tests/e2e/              # Playwright E2E tests
├── docker-compose.test.yml     # Test infrastructure
└── TESTING.md                  # This file - project overview
```

## Service Testing Overview

### API Gateway (Node.js)
- **Location**: `services/api-gateway/tests/`
- **Framework**: Jest
- **Types**: Unit, Integration, Security
- **Coverage**: >97% (all metrics)
- **Test Count**: 220+ tests
- **Real Dependencies**: PostgreSQL, Redis, LocalStack S3

### Ad Server (Go)
- **Location**: `services/ad-server/internal/*/\*_test.go`
- **Framework**: Go testing package
- **Types**: Integration tests with real Redis
- **Test Count**: 13 tests
- **Real Dependencies**: Redis (port 6380)

### Dashboard (Next.js)
- **Location**: `dashboard/tests/e2e/`
- **Framework**: Playwright
- **Types**: End-to-end tests
- **Test Count**: 20 E2E tests
- **Real Dependencies**: Full stack (API Gateway, PostgreSQL, Redis)

## Running Tests

### Quick Start - All Services

```bash
# Run all tests for all services
./scripts/test-all.sh test

# Run tests for specific service
./scripts/test-all.sh service api-gateway
./scripts/test-all.sh service ad-server
./scripts/test-all.sh service dashboard

# Generate coverage reports for all services
./scripts/test-all.sh coverage

# Install dependencies for all services
./scripts/test-all.sh install

# Clean up test artifacts
./scripts/test-all.sh clean
```

### API Gateway Tests

```bash
# Navigate to API Gateway
cd services/api-gateway

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:security     # Security tests only

# Run specific test file
npm test -- authService.test.js
```

### Go Ad Server Tests

```bash
# Navigate to ad-server
cd services/ad-server

# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run tests without cache
go clean -testcache && make test
```

### Dashboard E2E Tests

```bash
# Navigate to dashboard
cd dashboard

# Run E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# View test report
open playwright-report/index.html
```

### Docker-based Testing

```bash
# Run all tests in Docker
./scripts/test-docker.sh test

# Build test image only
./scripts/test-docker.sh build

# Generate coverage reports
./scripts/test-docker.sh coverage

# Interactive shell in test container
./scripts/test-docker.sh shell

# Clean up Docker resources
./scripts/test-docker.sh clean
```

## Test Infrastructure

### Test Services (docker-compose.test.yml)

| Service | Port | Purpose |
|---------|------|---------|
| postgres-test | 5433:5432 | Test database |
| redis-test | 6380:6379 | Test Redis instance |
| localstack-test | 4567:4566 | AWS services (S3) simulation |

### Environment Variables

**API Gateway Tests:**
```bash
NODE_ENV=test
DATABASE_URL=postgresql://adserver:dev_password@localhost:5433/adserver_test
REDIS_URL=redis://localhost:6380
JWT_SECRET=test-jwt-secret-key-for-testing-only
LOG_LEVEL=error
S3_ENDPOINT=http://localhost:4567
```

**Go Ad Server Tests:**
```bash
REDIS_TEST_URL=localhost:6380
API_GATEWAY_URL=http://localhost:3000
```

**Dashboard E2E Tests:**
```bash
# Tests run against real services
# API Gateway: http://localhost:3000
# Dashboard: http://localhost:3001
```

## Test Types by Service

### API Gateway (Node.js)
✅ **Test Structure:**
```
tests/
├── setup.js                       # Jest configuration and utilities
├── authService.test.js            # Authentication service unit tests
├── middleware.test.js             # Middleware unit tests
├── auth.integration.test.js       # Auth endpoints integration tests
├── campaigns.integration.test.js  # Campaign endpoints integration tests
├── creatives.integration.test.js  # Creative upload integration tests
├── security.test.js              # Security vulnerability tests
├── rateLimiting.test.js          # Rate limiting tests
└── errorHandling.test.js         # Error handling tests
```

**Coverage:** >97% (branches, functions, lines, statements)

### Ad Server (Go)
✅ **Test Structure:**
```
internal/
├── handlers/
│   └── ad_handler_test.go        # Handler integration tests
└── services/
    └── ad_service_test.go        # Service integration tests
```

**Tests Include:**
- Real Redis integration (port 6380)
- Ad request/response flow
- Campaign eligibility (dates, budget, status)
- Impression tracking
- Input validation

**All tests use REAL Redis - no mocks!**

### Dashboard (Next.js)
✅ **Test Structure:**
```
tests/e2e/
└── auth-flow.spec.ts             # Complete E2E test suite
```

**Tests Include:**
- Authentication flow (login, logout, persistence)
- Campaign creation and validation
- Creative upload and validation
- Navigation and routing
- Form validation
- Error handling

**All tests use REAL backend services - no mocks!**

## Coverage Reports

### Generating Coverage

```bash
# All services
./scripts/test-all.sh coverage

# Results in coverage-project/
# ├── api-gateway/          # Jest coverage HTML
# ├── ad-server/            # Go coverage HTML
# └── dashboard/            # Playwright test report
```

### Viewing Coverage

```bash
# API Gateway
open coverage-project/api-gateway/lcov-report/index.html

# Go Ad Server
open coverage-project/ad-server/coverage.html

# Dashboard
open coverage-project/dashboard/index.html
```

### Coverage Requirements

| Service | Current Coverage | Minimum Required |
|---------|-----------------|------------------|
| API Gateway | >97% | 80% |
| Ad Server | High (integration tests) | N/A |
| Dashboard | 20 E2E tests | N/A |

## CI/CD Integration

### GitHub Actions
- **File**: `.github/workflows/api-gateway-tests.yml`
- **Triggers**: Push to main, pull requests
- **Matrix**: Node.js 22.x
- **Services**: PostgreSQL 15, Redis 7, LocalStack

### Pipeline Stages
1. **Security Audit**: npm audit for vulnerabilities
2. **Unit Tests**: Component-level testing
3. **Integration Tests**: API endpoint testing
4. **Security Tests**: Protection mechanisms
5. **Coverage Reports**: Code coverage analysis

## Test Data Management

### API Gateway
- Unique test data per test run
- Automatic cleanup in `afterEach`/`afterAll`
- Separate test database (`adserver_test`)
- Test user accounts with known credentials

### Go Ad Server
- UUID-based test campaigns/creatives
- Redis test instance (port 6380)
- Cleanup after each test
- Isolated from production data

### Dashboard
- Creates real campaigns with timestamps
- Tests against actual backend
- Cleans up test data
- Uses test account: `advertiser@adserver.dev`

## Best Practices

### Writing Tests

1. **Isolation**: Tests should not depend on each other
2. **Cleanup**: Always clean up test data
3. **Real Dependencies**: Prefer real services over mocks
4. **Descriptive Names**: Clear test descriptions
5. **Assertions**: Multiple assertions per test are OK

### Test Organization

1. **Service-Specific**: Each service owns its tests
2. **Type Separation**: Unit vs Integration vs E2E
3. **Shared Utilities**: Common test helpers in `setup.js`
4. **Documentation**: Comment complex test scenarios

### Performance

1. **Parallel Execution**: Use Jest workers
2. **Test Database**: Faster than production DB
3. **Cleanup Strategy**: Efficient resource cleanup
4. **Selective Running**: Run only changed tests locally

## Debugging Tests

### API Gateway

```bash
# Run specific test with verbose output
npm test -- authService.test.js --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Check test database
psql postgresql://adserver:dev_password@localhost:5433/adserver_test
```

### Go Ad Server

```bash
# Run with verbose output
go test -v ./...

# Run specific test
go test -v -run TestSelectAd_Success ./internal/services

# Check test Redis
redis-cli -p 6380 keys "*"
```

### Dashboard

```bash
# Run in headed mode (see browser)
npm run test:e2e:headed

# Run with UI mode (interactive)
npm run test:e2e:ui

# Debug mode
PWDEBUG=1 npm run test:e2e
```

### Common Issues

**Database connection errors:**
```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
```

**Port conflicts:**
```bash
# Check what's using ports
lsof -i :5433  # PostgreSQL test
lsof -i :6380  # Redis test
lsof -i :4567  # LocalStack test
```

**Stale test data:**
```bash
# Reset test database
npm run db:reset

# Clear test Redis
redis-cli -p 6380 FLUSHALL
```

## Adding New Tests

### For API Gateway (Node.js)

1. Create test file in `services/api-gateway/tests/`
2. Use naming convention: `*.test.js` or `*.integration.test.js`
3. Import test utilities from `setup.js`
4. Follow existing patterns for cleanup
5. Run tests locally before committing

### For Go Ad Server

1. Create test file: `*_test.go` in same package
2. Use real Redis on port 6380
3. Implement setup/cleanup helpers
4. Use `testing.Short()` for integration tests
5. Run `make test` before committing

### For Dashboard

1. Add test scenarios to `tests/e2e/auth-flow.spec.ts`
2. Use Playwright assertions
3. Test against real backend
4. Include cleanup in test
5. Run `npm run test:e2e` before committing

## Project Status

### Completed ✅
- ✅ API Gateway: 220+ tests, >97% coverage
- ✅ Go Ad Server: 13 integration tests with real Redis
- ✅ Dashboard: 20 E2E tests with real backend
- ✅ Test infrastructure: PostgreSQL, Redis, LocalStack
- ✅ CI/CD pipeline for API Gateway
- ✅ Docker-based testing environment
- ✅ Project-wide test runner (`test-all.sh`)

### Test Summary
- **Total Tests**: 250+ across all services
- **Test Types**: Unit, Integration, E2E, Security
- **All Real**: No mocked dependencies for integration tests
- **Full Coverage**: API Gateway >97%, others well-tested

## Contributing

### Before Committing

1. Run tests locally: `./scripts/test-all.sh test`
2. Check coverage: `./scripts/test-all.sh coverage`
3. Ensure all tests pass
4. Add tests for new features
5. Update this document if adding new test types

### Test Requirements for PRs

- All existing tests must pass
- New features must include tests
- Maintain coverage requirements
- Integration tests preferred over unit tests with mocks
- Document complex test scenarios

For detailed service-specific testing information, see individual service documentation.
