# Next Steps: Comprehensive Test Coverage (90%+)

**Date:** October 2, 2025
**Status:** 🚧 In Progress
**Current Branch:** master
**Priority:** CRITICAL - Must achieve 90%+ coverage across all services

---

## 🎯 Objective

Achieve and maintain **90%+ test coverage** across all services with comprehensive integration and end-to-end tests. No skipping tests for any reason.

---

## 📋 Test Coverage Plan

### Phase 1: Infrastructure & Current Coverage Assessment ⏳

**Tasks:**
- [x] Start test infrastructure (PostgreSQL, Redis, LocalStack)
- [x] Create comprehensive test coverage plan
- [x] Create test-all-with-coverage.sh script
- [ ] Run existing API Gateway tests without skipping
- [ ] Measure current test coverage for Go ad server
- [ ] Measure current test coverage for API Gateway
- [ ] Measure current test coverage for Dashboard UI
- [ ] Document coverage gaps for each service

**Progress:**
- ✅ Test infrastructure running (PostgreSQL, Redis, LocalStack on ports 5433, 6380, 4567)
- ✅ Comprehensive 90%+ coverage plan documented
- ✅ Test runner script created (scripts/test-all-with-coverage.sh)
- 🔄 Ready to measure baseline coverage and add missing tests

**Commands:**
```bash
# API Gateway Coverage
cd services/api-gateway
npm test -- --coverage

# Go Ad Server Coverage
cd services/ad-server
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

# Dashboard Coverage
cd dashboard
npm test -- --coverage
```

---

### Phase 2: Go Ad Server Tests (Target: 90%+) 🔴

**Current Coverage:** Unknown (need to measure)

**Missing Test Areas:**
- [ ] Ad selection algorithm edge cases
  - Multiple eligible campaigns (weighted selection)
  - No eligible campaigns (all expired, over budget, inactive)
  - Campaign date boundary conditions
  - Budget boundary conditions (exactly at limit, $0.01 under)
- [ ] Impression tracking integration tests
  - HTTP POST to API Gateway success
  - HTTP POST failure handling (API Gateway down)
  - Retry logic validation
  - Timeout handling
- [ ] Redis client tests
  - Connection pooling
  - Error handling (Redis down, connection lost)
  - Data serialization/deserialization
  - Counter increment validation
- [ ] Handler tests
  - Request validation (missing fields, invalid formats)
  - Response format validation
  - Error response formats
  - HTTP status codes
- [ ] Integration tests
  - End-to-end: Ad request → Redis → Response
  - End-to-end: Impression → Redis + API Gateway POST
  - Multi-campaign selection scenarios
  - Creative rotation testing

**New Test Files to Create:**
```
services/ad-server/internal/
├── handlers/
│   └── ad_handler_integration_test.go (NEW)
├── services/
│   ├── ad_service_integration_test.go (NEW)
│   └── impression_tracking_test.go (NEW)
└── redis/
    └── client_test.go (NEW)
```

---

### Phase 3: API Gateway Tests (Target: 90%+) 🔴

**Current Coverage:** >97% (claimed, need to verify)

**Missing Test Areas:**
- [ ] Impression tracking integration tests
  - POST /api/v1/track-impression validation
  - Batch queuing behavior (99 impressions, 100 impressions, 101 impressions)
  - Flush timing (5-second interval)
  - Database persistence validation
  - campaign_daily_stats update validation
  - Error handling (database down, invalid data)
  - Concurrent impression handling
- [ ] ImpressionService tests
  - Queue management (add, flush, overflow)
  - Graceful shutdown (pending impressions flushed)
  - Database transaction rollback on error
  - Retry logic on flush failure
  - Performance under load (1000+ impressions)
- [ ] Redis sync service tests
  - PostgreSQL → Redis sync accuracy
  - Sync timing validation
  - Error handling (PostgreSQL down, Redis down)
  - Data consistency validation
  - Incremental vs full sync
- [ ] End-to-end campaign flow
  - Create campaign → Sync to Redis → Ad request → Impression → Stats update
  - Campaign budget depletion flow
  - Campaign status changes (active → paused)
  - Creative upload → Sync → Ad serving

**New Test Files to Create:**
```
services/api-gateway/tests/
├── impression.integration.test.js (NEW)
├── impression.service.test.js (NEW)
├── redis-sync.integration.test.js (NEW)
└── e2e/
    ├── campaign-to-ad-serving.e2e.test.js (NEW)
    └── impression-tracking.e2e.test.js (NEW)
```

---

### Phase 4: Dashboard UI Tests (Target: 90%+) 🔴

**Current Coverage:** Unknown (need to measure)

**Missing Test Areas:**
- [ ] Component unit tests
  - CampaignList component
  - CampaignForm component
  - CreativeUpload component
  - Navigation component
  - Layout component
- [ ] Integration tests
  - Campaign creation flow
  - Creative upload flow
  - Authentication flow
  - Error handling and display
- [ ] E2E tests (Playwright)
  - Complete campaign creation workflow
  - Creative upload with validation
  - Campaign list filtering and search
  - Authentication and logout
  - Navigation between pages
  - Error states and recovery

**New Test Files to Create:**
```
dashboard/
├── __tests__/
│   ├── components/
│   │   ├── CampaignList.test.tsx (NEW)
│   │   ├── CampaignForm.test.tsx (NEW)
│   │   ├── CreativeUpload.test.tsx (NEW)
│   │   └── Navigation.test.tsx (NEW)
│   └── integration/
│       ├── campaign-workflow.test.tsx (NEW)
│       └── creative-workflow.test.tsx (NEW)
└── e2e/
    ├── campaign-management.spec.ts (existing, expand)
    └── impression-analytics.spec.ts (NEW)
```

---

### Phase 5: Cross-Service Integration Tests 🔴

**Complete End-to-End Flows:**

1. **Campaign Creation to Ad Serving Flow**
   - [ ] Create campaign via API Gateway
   - [ ] Upload creative via API Gateway
   - [ ] Verify sync to Redis (campaign + creative)
   - [ ] Request ad from Go server
   - [ ] Verify correct creative returned
   - [ ] Track impression
   - [ ] Verify PostgreSQL persistence
   - [ ] Verify campaign_daily_stats updated

2. **Impression Tracking Flow**
   - [ ] Request ad from Go server
   - [ ] Post impression to Go server
   - [ ] Verify Redis counter incremented
   - [ ] Verify HTTP POST to API Gateway
   - [ ] Verify impression queued in ImpressionService
   - [ ] Wait for flush (or force flush)
   - [ ] Verify PostgreSQL ad_impressions record
   - [ ] Verify campaign_daily_stats incremented

3. **Budget Depletion Flow**
   - [ ] Create campaign with $100 budget
   - [ ] Track 100 impressions
   - [ ] Verify campaign still eligible
   - [ ] Track 1 more impression (over budget)
   - [ ] Verify campaign no longer eligible
   - [ ] Verify ad request returns different campaign

4. **Campaign Status Change Flow**
   - [ ] Create active campaign
   - [ ] Verify ad serving works
   - [ ] Pause campaign via API
   - [ ] Verify Redis sync updates status
   - [ ] Verify ad request excludes paused campaign
   - [ ] Reactivate campaign
   - [ ] Verify ad serving resumes

**Test File:**
```
tests/e2e/
└── full-ad-server-flow.test.js (NEW)
```

---

### Phase 6: Performance & Load Tests 🟡

**Performance Validation:**
- [ ] Go ad server latency (<10ms p99)
- [ ] Impression tracking throughput (2000+ req/sec)
- [ ] Database batch write performance (100 impressions <50ms)
- [ ] Redis sync performance (1000 campaigns <1s)
- [ ] Concurrent request handling (100+ simultaneous)

**Load Test Scenarios:**
```
tests/load/
├── ad-request-load.test.js (NEW)
├── impression-load.test.js (NEW)
└── concurrent-campaign-creation.test.js (NEW)
```

---

## 📊 Success Criteria

### Coverage Targets (MANDATORY)
- ✅ **Go Ad Server:** ≥90% coverage
- ✅ **API Gateway:** ≥90% coverage
- ✅ **Dashboard UI:** ≥90% coverage
- ✅ **All tests passing:** 0 failures, 0 skipped

### Quality Gates
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] All load tests passing
- [ ] No flaky tests (all tests pass 3 times in a row)
- [ ] Coverage reports generated for all services
- [ ] Coverage badges added to README

---

## 🛠️ Implementation Steps

### Step 1: Setup Test Infrastructure ✅
```bash
# Start test databases
cd /Users/fanwu/project/aws/ad-server
docker compose -f docker-compose.test.yml up -d postgres-test redis-test localstack-test

# Verify services healthy
docker compose -f docker-compose.test.yml ps
```

### Step 2: Measure Current Coverage (ALL TEST TYPES)

**CRITICAL: Measure coverage for EVERY test type separately:**

```bash
# ============================================
# Go Ad Server Coverage (ALL TESTS)
# ============================================
cd services/ad-server

# Unit tests coverage
go test ./internal/models/... -coverprofile=coverage-unit.out -covermode=atomic
go test ./internal/services/... -coverprofile=coverage-services.out -covermode=atomic
go test ./internal/handlers/... -coverprofile=coverage-handlers.out -covermode=atomic
go test ./internal/redis/... -coverprofile=coverage-redis.out -covermode=atomic

# Combined coverage (ALL tests)
go test ./... -coverprofile=coverage-all.out -covermode=atomic
go tool cover -func=coverage-all.out
go tool cover -html=coverage-all.out -o coverage/coverage.html

# Print summary
echo "=== Go Coverage Summary ==="
go tool cover -func=coverage-all.out | grep total


# ============================================
# API Gateway Coverage (ALL TESTS)
# ============================================
cd services/api-gateway

# Run ALL tests with coverage (unit + integration)
npm test -- --coverage --coverageReporters=text --coverageReporters=html --coverageReporters=json-summary

# Coverage breakdown by test type
npm test -- tests/unit --coverage --coverageReporters=text-summary
npm test -- tests/integration --coverage --coverageReporters=text-summary
npm test -- tests/e2e --coverage --coverageReporters=text-summary

# Print summary
echo "=== API Gateway Coverage Summary ==="
cat coverage/coverage-summary.json | jq '.total'


# ============================================
# Dashboard UI Coverage (ALL TESTS)
# ============================================
cd dashboard

# Run ALL tests with coverage (component + integration + E2E)
npm test -- --coverage --coverageReporters=text --coverageReporters=html --coverageReporters=json-summary

# Coverage by test type
npm test -- __tests__/components --coverage --coverageReporters=text-summary
npm test -- __tests__/integration --coverage --coverageReporters=text-summary
npm run test:e2e --coverage # Playwright E2E

# Print summary
echo "=== Dashboard Coverage Summary ==="
cat coverage/coverage-summary.json | jq '.total'
```

**Coverage must be measured for:**
1. ✅ Unit tests (individual functions/components)
2. ✅ Integration tests (service interactions)
3. ✅ E2E tests (complete user flows)
4. ✅ Combined (all tests together)

**NO SKIPPING:** All test types must run every time

### Step 3: Run All Existing Tests (NO SKIPPING - MANDATORY)

**CRITICAL RULES:**
- ❌ **NEVER skip any tests** - All tests must run
- ❌ **NEVER ignore failing tests** - Fix immediately
- ❌ **NEVER disable tests** - If a test fails, fix the code or the test
- ✅ **ALWAYS run complete test suite** - No partial runs
- ✅ **ALWAYS check exit codes** - 0 = success, anything else = failure

```bash
# ============================================
# API Gateway - ALL TESTS (NO SKIPPING)
# ============================================
cd services/api-gateway

# Run ALL tests with verbose output
npm test -- --verbose --runInBand --forceExit

# Verify ALL tests passed
if [ $? -ne 0 ]; then
  echo "❌ API Gateway tests FAILED - FIX BEFORE CONTINUING"
  exit 1
fi

echo "✅ All API Gateway tests passed"


# ============================================
# Go Ad Server - ALL TESTS (NO SKIPPING)
# ============================================
cd services/ad-server

# Run ALL tests with verbose output
go test ./... -v -race -timeout 30s

# Verify ALL tests passed
if [ $? -ne 0 ]; then
  echo "❌ Go tests FAILED - FIX BEFORE CONTINUING"
  exit 1
fi

echo "✅ All Go tests passed"


# ============================================
# Dashboard - ALL TESTS (NO SKIPPING)
# ============================================
cd dashboard

# Run ALL unit and integration tests
npm test -- --verbose --runInBand

# Verify ALL tests passed
if [ $? -ne 0 ]; then
  echo "❌ Dashboard tests FAILED - FIX BEFORE CONTINUING"
  exit 1
fi

# Run ALL E2E tests (Playwright)
npm run test:e2e

# Verify ALL E2E tests passed
if [ $? -ne 0 ]; then
  echo "❌ Dashboard E2E tests FAILED - FIX BEFORE CONTINUING"
  exit 1
fi

echo "✅ All Dashboard tests passed"


# ============================================
# SUMMARY
# ============================================
echo ""
echo "========================================="
echo "✅ ALL TESTS PASSED ACROSS ALL SERVICES"
echo "========================================="
echo "Go Ad Server: PASS"
echo "API Gateway: PASS"
echo "Dashboard UI: PASS"
echo "========================================="
```

**Test Exit Code Policy:**
- Exit code 0 = All tests passed ✅
- Exit code 1 = Tests failed ❌ STOP AND FIX
- Any skipped tests = FAILURE ❌ NO SKIPS ALLOWED

### Step 4: Add Missing Tests (Coverage-Driven Development)

**Iterative Process - Repeat until 90%+ coverage:**

1. **Measure current coverage** (Step 2 commands)
2. **Identify uncovered code** (use HTML coverage reports)
3. **Write tests for uncovered code**
4. **Run ALL tests** (Step 3 commands) - **NO SKIPPING**
5. **Measure coverage again** - must increase or equal
6. **Repeat until ≥90%**

```bash
# ============================================
# Test-Driven Coverage Loop (Example)
# ============================================

# 1. Baseline coverage
cd services/ad-server
go test ./... -coverprofile=coverage.out -covermode=atomic
INITIAL_COV=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')
echo "Initial coverage: $INITIAL_COV"

# 2. Open HTML report to find gaps
go tool cover -html=coverage.out -o coverage/coverage.html
# Open in browser: open coverage/coverage.html
# Identify: Red lines = not covered, need tests

# 3. Write new tests for uncovered code
# Create: internal/services/ad_service_integration_test.go

# 4. Run ALL tests again (NO SKIPPING)
go test ./... -v -coverprofile=coverage-new.out -covermode=atomic

# 5. Verify coverage increased
NEW_COV=$(go tool cover -func=coverage-new.out | grep total | awk '{print $3}')
echo "New coverage: $NEW_COV (was $INITIAL_COV)"

# 6. Coverage must ONLY INCREASE
if [ "$NEW_COV" \< "$INITIAL_COV" ]; then
  echo "❌ COVERAGE DECREASED - REVERT CHANGES"
  exit 1
fi

# 7. Repeat until ≥90%
```

**Coverage Rules:**
- ❌ **NEVER lower coverage** - Revert if coverage drops
- ✅ **ALWAYS run ALL tests** - Coverage from complete suite only
- ✅ **ALWAYS verify increase** - Each iteration must improve coverage
- 🎯 **Target: 90%+** - Don't stop until target reached

### Step 5: Continuous Validation (After Every Change)

**MANDATORY: Run after EVERY code change**

```bash
#!/bin/bash
# scripts/test-all.sh - Run ALL tests across ALL services

set -e  # Exit on any failure

echo "🧪 Running COMPLETE test suite across all services..."
echo ""

# ============================================
# Go Ad Server
# ============================================
echo "📦 Testing Go Ad Server..."
cd services/ad-server
go test ./... -v -race -coverprofile=coverage.out -covermode=atomic
GO_EXIT=$?
GO_COV=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')
echo "Go Coverage: $GO_COV"

if [ $GO_EXIT -ne 0 ]; then
  echo "❌ Go tests FAILED"
  exit 1
fi

GO_COV_NUM=$(echo $GO_COV | sed 's/%//')
if (( $(echo "$GO_COV_NUM < 90.0" | bc -l) )); then
  echo "❌ Go coverage $GO_COV is below 90%"
  exit 1
fi

echo "✅ Go tests passed with $GO_COV coverage"
echo ""

# ============================================
# API Gateway
# ============================================
echo "📦 Testing API Gateway..."
cd ../../services/api-gateway
npm test -- --coverage --coverageThreshold='{"global":{"lines":90,"statements":90,"functions":90,"branches":90}}'
API_EXIT=$?

if [ $API_EXIT -ne 0 ]; then
  echo "❌ API Gateway tests FAILED or coverage below 90%"
  exit 1
fi

echo "✅ API Gateway tests passed with ≥90% coverage"
echo ""

# ============================================
# Dashboard
# ============================================
echo "📦 Testing Dashboard..."
cd ../../dashboard
npm test -- --coverage --coverageThreshold='{"global":{"lines":90,"statements":90,"functions":90,"branches":90}}'
DASH_EXIT=$?

if [ $DASH_EXIT -ne 0 ]; then
  echo "❌ Dashboard tests FAILED or coverage below 90%"
  exit 1
fi

echo "✅ Dashboard tests passed with ≥90% coverage"
echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "========================================="
echo "🎉 ALL TESTS PASSED - ALL COVERAGE ≥90%"
echo "========================================="
echo "✅ Go Ad Server: PASS ($GO_COV)"
echo "✅ API Gateway: PASS (≥90%)"
echo "✅ Dashboard UI: PASS (≥90%)"
echo "========================================="
```

**Run this script:**
- ✅ Before every commit
- ✅ After every code change
- ✅ Before creating PR
- ✅ In CI/CD pipeline
- ✅ After pulling latest code

---

## 📁 Files to Create/Modify

### New Test Files (Estimated: 20+ files)
1. **Go Tests (8 files)**
   - `ad_handler_integration_test.go`
   - `ad_service_integration_test.go`
   - `impression_tracking_test.go`
   - `redis_client_test.go`
   - `ad_selection_edge_cases_test.go`
   - `error_handling_test.go`
   - `performance_test.go`
   - `e2e_flow_test.go`

2. **API Gateway Tests (7 files)**
   - `impression.integration.test.js`
   - `impression.service.test.js`
   - `redis-sync.integration.test.js`
   - `campaign-to-ad-serving.e2e.test.js`
   - `impression-tracking.e2e.test.js`
   - `full-flow.e2e.test.js`
   - `performance.test.js`

3. **Dashboard Tests (5 files)**
   - `CampaignList.test.tsx`
   - `CampaignForm.test.tsx`
   - `CreativeUpload.test.tsx`
   - `campaign-workflow.test.tsx`
   - `impression-analytics.spec.ts`

### Scripts to Create
```bash
scripts/
├── test-all.sh                    # Run all tests across all services
├── verify-coverage.sh             # Check coverage thresholds
├── generate-coverage-reports.sh   # Generate HTML coverage reports
└── ci-test-suite.sh              # CI/CD test runner
```

---

## ⚠️ Critical Rules

1. **NO SKIPPING TESTS** - Every test must run and pass
2. **NO LOWERING COVERAGE** - Coverage can only increase, never decrease
3. **90% MINIMUM** - No service below 90% coverage
4. **ALL TESTS GREEN** - 0 failures, 0 errors, 0 skipped
5. **TESTS BEFORE CODE** - Write tests for all new features
6. **INTEGRATION REQUIRED** - Unit tests alone are insufficient
7. **E2E VALIDATION** - Complete flows must be tested end-to-end

---

## 📈 Coverage Tracking

### Current Status (MEASURED - Oct 2, 2025)
| Service | Current Coverage | Target | Gap | Status |
|---------|-----------------|---------|-----|--------|
| Go Ad Server | 0.0% | 90% | +90.0% | 🔴 CRITICAL |
| API Gateway | 16.09% | 90% | +73.91% | 🔴 CRITICAL |
| Dashboard UI | Unknown | 90% | ~+90% | ⚠️ NOT MEASURED |

**Breakdown (API Gateway):**
- Statements: 16.09% (177/1100)
- Branches: 7.71% (26/337)
- Functions: 6.61% (9/136)
- Lines: 16.28% (177/1087)

**Issues:**
- 🔴 Go: Tests exist but don't cover real code (mocked)
- 🔴 API Gateway: 245 tests failing due to timeout in cleanup
- ⚠️ Dashboard: Not yet measured

**See TEST_COVERAGE_STATUS.md for detailed gap analysis and action plan.**

### Coverage Reports Location
```
services/ad-server/coverage/coverage.html
services/api-gateway/coverage/index.html
dashboard/coverage/index.html
```

---

## 🚀 Timeline

**Total Estimated Time:** 2-3 days

- **Day 1 Morning:** Measure coverage, run all existing tests
- **Day 1 Afternoon:** Add Go ad server tests (target 90%)
- **Day 2 Morning:** Add API Gateway tests (target 90%)
- **Day 2 Afternoon:** Add Dashboard tests (target 90%)
- **Day 3:** Integration tests, E2E tests, performance validation

---

## 📝 Completion Checklist

- [ ] Test infrastructure running (PostgreSQL, Redis, LocalStack)
- [ ] Current coverage measured for all services
- [ ] All existing tests passing (Go + API Gateway + Dashboard)
- [ ] Go ad server: 90%+ coverage with new tests
- [ ] API Gateway: 90%+ coverage with new tests
- [ ] Dashboard: 90%+ coverage with new tests
- [ ] E2E test suite created and passing
- [ ] Performance tests added and passing
- [ ] Coverage reports generated
- [ ] Coverage badges added to README
- [ ] CI/CD updated with coverage thresholds
- [ ] All tests run successfully 3+ times (no flaky tests)
- [ ] Documentation updated

---

**Previous Work:** See bottom of file for completed impression tracking implementation.

---

---

# ARCHIVE: Previous Implementation (Impression Tracking) ✅

## ✅ Implementation Complete

**All tasks have been successfully completed:**
- ✅ ImpressionService integrated into API Gateway
- ✅ Go Ad Server updated to POST impressions to Node.js
- ✅ End-to-end test script created (test-impression-flow.sh)
- ✅ Go tests passing (7 handler tests + 2 service tests)
- ✅ PROGRESS.md updated with impression tracking details

**Files Modified:**
1. `services/api-gateway/src/server.js` - Added impression service startup/shutdown
2. `services/api-gateway/src/app.js` - Registered impression routes
3. `services/api-gateway/src/routes/impression.routes.js` - NEW: Impression tracking endpoint
4. `services/ad-server/internal/services/ad_service.go` - Added HTTP client and POST to API Gateway
5. `services/ad-server/internal/models/ad.go` - Added missing fields to ImpressionRequest
6. `test-impression-flow.sh` - NEW: End-to-end test script
7. `PROGRESS.md` - Updated with impression tracking completion
