#!/bin/bash

# Test Automation Script for API Gateway
# This script runs comprehensive tests with proper setup and teardown

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DB_NAME="adserver_test"
REDIS_URL="redis://localhost:6379"
POSTGRES_USER="adserver"
POSTGRES_PASSWORD="dev_password"
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if service is running
check_service() {
    local service=$1
    local port=$2

    if nc -z localhost $port 2>/dev/null; then
        print_success "$service is running on port $port"
        return 0
    else
        print_error "$service is not running on port $port"
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local port=$2
    local timeout=${3:-30}

    print_status "Waiting for $service on port $port..."

    for i in $(seq 1 $timeout); do
        if nc -z localhost $port 2>/dev/null; then
            print_success "$service is ready"
            return 0
        fi
        sleep 1
    done

    print_error "$service failed to start within $timeout seconds"
    return 1
}

# Function to setup test environment
setup_test_env() {
    print_status "Setting up test environment..."

    # Check if PostgreSQL is running
    if ! check_service "PostgreSQL" 5432; then
        print_error "PostgreSQL is required for tests. Please start PostgreSQL service."
        exit 1
    fi

    # Check if Redis is running
    if ! check_service "Redis" 6379; then
        print_warning "Redis is not running. Tests will use Redis mocks."
    fi

    # Create test database if it doesn't exist
    print_status "Setting up test database..."
    export PGPASSWORD=$POSTGRES_PASSWORD

    if ! psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -lqt | cut -d \| -f 1 | grep -qw $TEST_DB_NAME; then
        print_status "Creating test database: $TEST_DB_NAME"
        createdb -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER $TEST_DB_NAME
        print_success "Test database created"
    else
        print_status "Test database already exists"
    fi

    # Set test environment variables
    export NODE_ENV=test
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$TEST_DB_NAME"
    export DATABASE_TEST_URL=$DATABASE_URL
    export REDIS_URL=$REDIS_URL
    export JWT_SECRET="test-jwt-secret-key-for-testing-only-not-for-production"
    export LOG_LEVEL=error

    print_success "Test environment setup complete"
}

# Function to run different test suites
run_test_suite() {
    local suite_name=$1
    local test_pattern=$2

    print_status "Running $suite_name tests..."

    if [ -n "$test_pattern" ]; then
        npm test -- --testNamePattern="$test_pattern" --verbose
    else
        npm test
    fi

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        print_success "$suite_name tests passed"
    else
        print_error "$suite_name tests failed with exit code $exit_code"
    fi

    return $exit_code
}

# Function to cleanup test environment
cleanup_test_env() {
    print_status "Cleaning up test environment..."

    # Clean up test data (Redis flush is handled in test setup)
    if [ -n "$DATABASE_URL" ]; then
        print_status "Cleaning up test database..."
        export PGPASSWORD=$POSTGRES_PASSWORD
        psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $TEST_DB_NAME -c "
            DELETE FROM users WHERE email LIKE '%test%';
        " 2>/dev/null || true
    fi

    print_success "Cleanup complete"
}

# Function to run coverage report
run_coverage() {
    print_status "Generating test coverage report..."
    npm run test:coverage

    if [ -d "coverage" ]; then
        print_success "Coverage report generated in ./coverage/"
        print_status "Open coverage/lcov-report/index.html to view detailed coverage"
    fi
}

# Function to run lint checks (if linter is available)
run_lint_checks() {
    if npm list eslint &>/dev/null; then
        print_status "Running ESLint checks..."
        npm run lint 2>/dev/null || {
            print_warning "ESLint not configured or failed"
        }
    else
        print_status "ESLint not found, skipping lint checks"
    fi
}

# Function to run security audit
run_security_audit() {
    print_status "Running security audit..."
    npm audit --audit-level=moderate || {
        print_warning "Security vulnerabilities found - review npm audit output"
    }
}

# Main execution
main() {
    local test_type=${1:-"all"}
    local skip_setup=${2:-false}

    print_status "Starting API Gateway test automation..."
    print_status "Test type: $test_type"

    # Setup test environment unless skipped
    if [ "$skip_setup" != "true" ]; then
        setup_test_env
    fi

    # Trap cleanup function on script exit
    trap cleanup_test_env EXIT

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi

    # Run security audit
    run_security_audit

    # Run lint checks
    run_lint_checks

    # Navigate to API Gateway directory if not already there
    cd "$(dirname "$0")/.."

    case $test_type in
        "unit")
            print_status "Running unit tests only..."
            run_test_suite "Unit" "authService|middleware"
            ;;
        "integration")
            print_status "Running integration tests only..."
            run_test_suite "Integration" "integration"
            ;;
        "security")
            print_status "Running security tests only..."
            run_test_suite "Security" "security|rateLimiting|errorHandling"
            ;;
        "coverage")
            run_coverage
            ;;
        "ci")
            print_status "Running CI test suite..."
            run_test_suite "All Tests" ""
            run_coverage
            ;;
        "all"|*)
            print_status "Running all test suites..."

            # Run tests in logical order
            run_test_suite "Unit Tests" "authService|middleware" || exit 1
            run_test_suite "Integration Tests" "integration" || exit 1
            run_test_suite "Security Tests" "security|rateLimiting|errorHandling" || exit 1

            print_success "All test suites completed successfully!"

            # Generate coverage report
            run_coverage
            ;;
    esac

    print_success "Test automation completed!"
}

# Help function
show_help() {
    echo "API Gateway Test Automation Script"
    echo ""
    echo "Usage: $0 [test_type] [skip_setup]"
    echo ""
    echo "Test Types:"
    echo "  all         Run all test suites (default)"
    echo "  unit        Run unit tests only"
    echo "  integration Run integration tests only"
    echo "  security    Run security tests only"
    echo "  coverage    Generate coverage report only"
    echo "  ci          Run CI test suite with coverage"
    echo ""
    echo "Options:"
    echo "  skip_setup  Set to 'true' to skip test environment setup"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 unit              # Run unit tests only"
    echo "  $0 security          # Run security tests only"
    echo "  $0 ci                # Run CI test suite"
    echo "  $0 all true          # Run all tests, skip setup"
    echo ""
    echo "Requirements:"
    echo "  - PostgreSQL running on localhost:5432"
    echo "  - Redis running on localhost:6379 (optional)"
    echo "  - Node.js and npm installed"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function with arguments
main "$@"