#!/bin/bash

# Project-wide Test Runner for CTV Ad Server
# This script orchestrates testing across all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="CTV Ad Server"
SERVICES=("api-gateway")  # Add more services as they're implemented

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

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if we're in the project root
    if [ ! -f "package.json" ] || [ ! -d "services" ]; then
        print_error "Must be run from project root directory"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Function to install dependencies for all services
install_dependencies() {
    print_status "Installing dependencies for all services..."

    # Root dependencies
    print_status "Installing root dependencies..."
    npm install

    # Service dependencies
    for service in "${SERVICES[@]}"; do
        print_status "Installing dependencies for $service..."
        if [ -d "services/$service" ]; then
            (cd "services/$service" && npm install)
        else
            print_warning "Service directory services/$service not found"
        fi
    done

    print_success "All dependencies installed"
}

# Function to run tests for a specific service
run_service_tests() {
    local service=$1
    local test_type=${2:-"all"}

    print_header "Testing $service"

    if [ ! -d "services/$service" ]; then
        print_error "Service directory services/$service not found"
        return 1
    fi

    cd "services/$service"

    # Check if service has tests
    if [ ! -d "tests" ]; then
        print_warning "No tests directory found for $service"
        cd - > /dev/null
        return 0
    fi

    # Run the service-specific test script if it exists
    if [ -f "scripts/test.sh" ]; then
        print_status "Running $service test script..."
        ./scripts/test.sh "$test_type"
    else
        # Fall back to npm test
        print_status "Running npm test for $service..."
        case $test_type in
            "unit")
                npm run test:unit 2>/dev/null || npm test
                ;;
            "integration")
                npm run test:integration 2>/dev/null || npm test
                ;;
            "security")
                npm run test:security 2>/dev/null || npm test
                ;;
            "coverage")
                npm run test:coverage 2>/dev/null || npm test
                ;;
            *)
                npm test
                ;;
        esac
    fi

    local exit_code=$?
    cd - > /dev/null

    if [ $exit_code -eq 0 ]; then
        print_success "$service tests passed"
    else
        print_error "$service tests failed"
    fi

    return $exit_code
}

# Function to run tests for all services
run_all_tests() {
    local test_type=${1:-"all"}
    local failed_services=()

    print_header "$PROJECT_NAME - Running All Tests"

    for service in "${SERVICES[@]}"; do
        if ! run_service_tests "$service" "$test_type"; then
            failed_services+=("$service")
        fi
        echo ""
    done

    # Summary
    print_header "Test Summary"

    if [ ${#failed_services[@]} -eq 0 ]; then
        print_success "All service tests passed!"
        return 0
    else
        print_error "Tests failed for: ${failed_services[*]}"
        return 1
    fi
}

# Function to generate project-wide coverage report
generate_coverage() {
    print_header "Generating Project Coverage Report"

    local coverage_dir="coverage-project"
    mkdir -p "$coverage_dir"

    for service in "${SERVICES[@]}"; do
        print_status "Generating coverage for $service..."

        if [ -d "services/$service" ]; then
            (cd "services/$service" && npm run test:coverage 2>/dev/null || npm test)

            # Copy coverage reports
            if [ -d "services/$service/coverage" ]; then
                mkdir -p "$coverage_dir/$service"
                cp -r "services/$service/coverage/"* "$coverage_dir/$service/"
                print_success "Coverage report copied for $service"
            fi
        fi
    done

    print_success "Project coverage reports generated in $coverage_dir/"
}

# Function to run security audit for all services
run_security_audit() {
    print_header "Running Security Audit"

    # Root level audit
    print_status "Running security audit for root dependencies..."
    npm audit --audit-level=moderate || print_warning "Security issues found in root dependencies"

    # Service level audits
    for service in "${SERVICES[@]}"; do
        print_status "Running security audit for $service..."
        if [ -d "services/$service" ]; then
            (cd "services/$service" && npm audit --audit-level=moderate) || print_warning "Security issues found in $service"
        fi
    done

    print_success "Security audit completed"
}

# Function to clean up test artifacts
cleanup() {
    print_status "Cleaning up test artifacts..."

    # Remove coverage directories
    rm -rf coverage-project/

    for service in "${SERVICES[@]}"; do
        if [ -d "services/$service" ]; then
            (cd "services/$service" && npm run clean:test 2>/dev/null || true)
        fi
    done

    print_success "Cleanup completed"
}

# Main execution function
main() {
    local command=${1:-"test"}
    local test_type=${2:-"all"}

    print_header "$PROJECT_NAME Test Runner"

    # Navigate to project root
    cd "$(dirname "$0")/.."

    case $command in
        "install"|"setup")
            check_prerequisites
            install_dependencies
            ;;
        "test")
            check_prerequisites
            run_all_tests "$test_type"
            ;;
        "coverage")
            check_prerequisites
            generate_coverage
            ;;
        "audit")
            check_prerequisites
            run_security_audit
            ;;
        "clean")
            cleanup
            ;;
        "service")
            local service_name=$test_type
            local service_test_type=${3:-"all"}
            check_prerequisites
            run_service_tests "$service_name" "$service_test_type"
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Help function
show_help() {
    echo "$PROJECT_NAME Test Runner"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  install        Install dependencies for all services"
    echo "  test [type]    Run tests for all services"
    echo "  coverage       Generate coverage reports for all services"
    echo "  audit          Run security audit for all services"
    echo "  clean          Clean up test artifacts"
    echo "  service <name> [type]  Run tests for specific service"
    echo ""
    echo "Test Types:"
    echo "  all           Run all tests (default)"
    echo "  unit          Run unit tests only"
    echo "  integration   Run integration tests only"
    echo "  security      Run security tests only"
    echo ""
    echo "Examples:"
    echo "  $0 install           # Install all dependencies"
    echo "  $0 test              # Run all tests for all services"
    echo "  $0 test unit         # Run unit tests for all services"
    echo "  $0 coverage          # Generate coverage reports"
    echo "  $0 service api-gateway unit  # Run unit tests for API Gateway only"
    echo "  $0 audit             # Run security audit"
    echo "  $0 clean             # Clean up test artifacts"
    echo ""
    echo "Services:"
    for service in "${SERVICES[@]}"; do
        echo "  - $service"
    done
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"