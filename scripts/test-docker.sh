#!/bin/bash

# Docker-based Test Runner for API Gateway
# This script runs tests in isolated Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOCKER_COMPOSE=()

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

set_compose_command() {
    if [ ${#DOCKER_COMPOSE[@]} -gt 0 ]; then
        return
    fi

    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE=(docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE=(docker-compose)
    else
        print_error "Docker Compose is not available"
        exit 1
    fi
}

# Function to cleanup Docker resources
cleanup_docker() {
    print_status "Cleaning up Docker resources..."

    set_compose_command

    # Stop and remove containers
    if [ ${#DOCKER_COMPOSE[@]} -gt 0 ]; then
        ${DOCKER_COMPOSE[@]} -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    fi

    # Remove test images
    docker image prune -f 2>/dev/null || true

    print_success "Docker cleanup completed"
}

# Function to check Docker availability
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running"
        exit 1
    fi

    set_compose_command

    print_success "Docker environment is ready"
}

# Function to build test image
build_test_image() {
    print_status "Building test Docker image..."

    set_compose_command

    if "${DOCKER_COMPOSE[@]}" -f docker-compose.test.yml build; then
        print_success "Test image built successfully"
    else
        print_error "Failed to build test image"
        exit 1
    fi
}

# Function to run tests in Docker
run_docker_tests() {
    local test_mode=${1:-"test"}

    print_status "Starting Docker test environment (${test_mode})..."

    trap cleanup_docker EXIT

    set_compose_command

    mkdir -p services/api-gateway/coverage services/api-gateway/logs

    local compose_args=(-f docker-compose.test.yml up --abort-on-container-exit --exit-code-from api-gateway-test)
    local compose_cmd=("${DOCKER_COMPOSE[@]}" "${compose_args[@]}")
    local exit_code=0

    if [ "$test_mode" = "coverage" ]; then
        env TEST_COMMAND=coverage "${compose_cmd[@]}" || exit_code=$?
    else
        "${compose_cmd[@]}" || exit_code=$?
    fi

    if [ $exit_code -eq 0 ]; then
        print_success "Docker tests completed successfully"
    else
        print_error "Tests failed in Docker environment"
        print_status "Showing container logs..."
        "${DOCKER_COMPOSE[@]}" -f docker-compose.test.yml logs
        exit $exit_code
    fi
}

# Function to run specific test command in container
run_docker_command() {
    local command=$1

    print_status "Running command in Docker: $command"

    set_compose_command

    "${DOCKER_COMPOSE[@]}" -f docker-compose.test.yml run --rm --service-ports --use-aliases api-gateway-test $command
}

# Function to extract coverage reports
extract_coverage() {
    print_status "Extracting coverage reports..."

    run_docker_tests coverage

    local source_dir=services/api-gateway/coverage
    local target_dir=coverage-docker/api-gateway

    if [ -d "$source_dir" ]; then
        mkdir -p "$target_dir"
        cp -R "$source_dir/"* "$target_dir/" 2>/dev/null || true
        print_success "Coverage reports copied to $target_dir"
    else
        print_warning "Coverage directory not found after Docker run"
    fi
}

# Main execution
main() {
    local command=${1:-"test"}

    print_status "Starting Docker-based test runner..."

    # Navigate to API Gateway directory
    cd "$(dirname "$0")/.."

    check_docker

    case $command in
        "build")
            build_test_image
            ;;
        "test")
            build_test_image
            run_docker_tests
            ;;
        "coverage")
            build_test_image
            extract_coverage
            ;;
        "clean")
            cleanup_docker
            ;;
        "shell")
            print_status "Starting interactive shell in test container..."
            set_compose_command
            "${DOCKER_COMPOSE[@]}" -f docker-compose.test.yml run --rm --service-ports --use-aliases api-gateway-test /bin/sh
            ;;
        "logs")
            print_status "Showing test container logs..."
            set_compose_command
            "${DOCKER_COMPOSE[@]}" -f docker-compose.test.yml logs api-gateway-test
            ;;
        *)
            print_status "Running custom command: $command"
            run_docker_command "$command"
            ;;
    esac

    print_success "Docker test runner completed!"
}

# Help function
show_help() {
    echo "Docker-based Test Runner for API Gateway"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  test        Build and run all tests (default)"
    echo "  build       Build test Docker image only"
    echo "  coverage    Generate coverage reports"
    echo "  clean       Clean up Docker resources"
    echo "  shell       Start interactive shell in test container"
    echo "  logs        Show test container logs"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 build             # Build test image"
    echo "  $0 coverage          # Generate coverage"
    echo "  $0 clean             # Clean up Docker"
    echo "  $0 shell             # Interactive shell"
    echo ""
    echo "Requirements:"
    echo "  - Docker and Docker Compose installed"
    echo "  - Docker daemon running"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"