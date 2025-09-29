# CTV Ad Server Testing Guide

This document provides comprehensive information about testing across all services in the CTV Ad Server project.

## Project Testing Structure

```
/
├── .github/workflows/           # CI/CD workflows
│   └── api-gateway-tests.yml   # API Gateway testing pipeline
├── services/
│   └── api-gateway/
│       ├── tests/              # Test files
│       ├── scripts/            # Test automation scripts
│       ├── docker-compose.test.yml # Docker test environment
│       ├── Dockerfile.test     # Test container
│       └── TESTING.md          # Service-specific testing guide
└── TESTING.md                  # This file - project overview
```

## Service Testing

### API Gateway Testing
- **Location**: `services/api-gateway/tests/`
- **Types**: Unit, Integration, Security, Rate Limiting, Error Handling
- **Coverage**: 80% minimum threshold
- **Automation**: GitHub Actions, Docker, Local scripts

#### Test Structure
```
tests/
├── setup.js                    # Jest test setup and utilities
├── authService.test.js         # Unit tests for authentication service
├── middleware.test.js          # Unit tests for middleware components
├── auth.integration.test.js    # Integration tests for auth endpoints
├── campaigns.integration.test.js # Integration tests for campaign endpoints
├── security.test.js           # Security and vulnerability tests
├── rateLimiting.test.js       # Rate limiting tests
└── errorHandling.test.js      # Error handling tests
```

## Running Tests

### Prerequisites
- Node.js 18+ installed
- PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379` (optional, uses mocks)
- Docker and Docker Compose (for containerized testing)

### Quick Start
```bash
# Navigate to API Gateway
cd services/api-gateway

# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Scripts
```bash
# Local automated testing
./services/api-gateway/scripts/test.sh

# Docker-based testing
./services/api-gateway/scripts/run-tests-docker.sh

# Specific test types
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:security     # Security tests only
```

## CI/CD Integration

### GitHub Actions
- **File**: `.github/workflows/api-gateway-tests.yml`
- **Triggers**: Push to main branches, pull requests
- **Matrix**: Node.js 18.x and 20.x
- **Services**: PostgreSQL 15, Redis 7

### Pipeline Stages
1. **Code Quality**: Security audit, package validation
2. **Unit Tests**: Component-level testing
3. **Integration Tests**: API endpoint testing
4. **Security Tests**: Vulnerability and protection testing
5. **Coverage Reports**: Code coverage analysis
6. **Performance Tests**: Response time and memory usage (PR only)

## Test Types by Service

### API Gateway
- ✅ **Unit Tests**: Authentication service, middleware components
- ✅ **Integration Tests**: Auth endpoints, campaign endpoints
- ✅ **Security Tests**: Headers, CORS, input validation, auth security
- ✅ **Rate Limiting Tests**: API throttling, enforcement, configuration
- ✅ **Error Handling Tests**: 404s, validation errors, internal errors

### Future Services
- 🔄 **Ad Server Core**: Campaign processing, ad serving logic
- 🔄 **Analytics Service**: Metrics collection, reporting
- 🔄 **Content Delivery**: Video streaming, ad insertion
- 🔄 **Database Layer**: Data access, migrations, performance

## Environment Configuration

### Test Environment Variables
```bash
NODE_ENV=test
DATABASE_URL=postgresql://adserver:dev_password@localhost:5432/adserver_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-key-for-testing-only
LOG_LEVEL=error
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Docker Testing Environment
- **PostgreSQL**: Container with test database
- **Redis**: Container for caching tests
- **Isolated Network**: Prevents interference with local services
- **Volume Mapping**: Coverage reports and logs accessible locally

## Coverage Requirements

### Project-Wide Standards
- **Minimum Coverage**: 80% for all metrics
- **Metrics**: Branches, Functions, Lines, Statements
- **Reporting**: LCOV format, HTML reports
- **CI Integration**: Coverage uploaded to Codecov

### Current Coverage
- **API Gateway**: 80%+ across all metrics
- **Other Services**: TBD as they're implemented

## Best Practices

### Test Organization
1. **Service Isolation**: Each service has its own test suite
2. **Test Types**: Clear separation of unit, integration, security tests
3. **Naming Conventions**: Descriptive test and file names
4. **Documentation**: Each service has testing documentation

### Data Management
1. **Test Data**: Unique, isolated test data per test
2. **Cleanup**: Automatic cleanup in test teardown
3. **Database**: Separate test database instances
4. **Secrets**: Test-specific secrets and tokens

### CI/CD Integration
1. **Automation**: All tests run automatically on commits
2. **Matrix Testing**: Multiple Node.js versions
3. **Artifact Storage**: Coverage reports and logs preserved
4. **Performance Monitoring**: Response time tracking

## Debugging and Troubleshooting

### Common Issues
1. **Database Connection**: Ensure PostgreSQL is running
2. **Redis Connection**: Tests use mocks if Redis unavailable
3. **Port Conflicts**: Use test-specific ports in Docker
4. **Test Isolation**: Ensure proper cleanup between tests

### Debugging Commands
```bash
# Run specific service tests
cd services/api-gateway && npm test

# Debug specific test file
npm test -- authService.test.js --verbose

# Run with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Check service health
curl http://localhost:3000/health
```

### Log Analysis
```bash
# Service logs
tail -f services/api-gateway/logs/test-*.log

# CI/CD logs
# Available in GitHub Actions interface

# Docker logs
docker-compose -f services/api-gateway/docker-compose.test.yml logs
```

## Adding New Services

When adding a new service, include:

### Required Files
1. **Test Directory**: `services/{service}/tests/`
2. **Test Scripts**: `services/{service}/scripts/test.sh`
3. **Docker Setup**: `services/{service}/docker-compose.test.yml`
4. **CI Workflow**: `.github/workflows/{service}-tests.yml`
5. **Documentation**: `services/{service}/TESTING.md`

### Test Categories
1. **Unit Tests**: Component isolation testing
2. **Integration Tests**: Service API testing
3. **Security Tests**: Vulnerability and protection testing
4. **Performance Tests**: Load and response time testing
5. **Contract Tests**: Inter-service communication testing

### Integration Points
1. **Root Scripts**: Add service to project-wide test runners
2. **CI Pipeline**: Include in main project CI workflow
3. **Coverage**: Add to project coverage aggregation
4. **Documentation**: Update this file with new service info

## Project Status

### Completed ✅
- API Gateway comprehensive testing suite
- CI/CD pipeline for API Gateway
- Docker-based testing environment
- Security and vulnerability testing
- Rate limiting and error handling tests

### In Progress 🔄
- Performance testing optimization
- Cross-service integration testing framework
- Monitoring and alerting for test failures

### Planned 📋
- Ad Server Core testing suite
- Analytics Service testing
- End-to-end testing across services
- Load testing and performance benchmarks
- Chaos engineering tests

## Contributing

### Adding Tests
1. Follow service-specific testing patterns
2. Maintain minimum coverage requirements
3. Include security and error testing
4. Update documentation as needed

### Running Local Tests
1. Ensure all prerequisites are installed
2. Run service-specific test suites
3. Verify coverage meets requirements
4. Test in Docker environment before committing

### CI/CD Changes
1. Test workflow changes locally first
2. Ensure backward compatibility
3. Update documentation for new features
4. Monitor pipeline performance impact

For detailed service-specific testing information, see individual service TESTING.md files.