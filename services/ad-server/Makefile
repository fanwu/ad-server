.PHONY: build run test clean dev install

# Build the ad server binary
build:
	@echo "Building ad server..."
	@go build -o bin/ad-server ./cmd/server
	@echo "Build complete: bin/ad-server"

# Build optimized production binary
build-prod:
	@echo "Building production ad server..."
	@go build -ldflags="-s -w" -o bin/ad-server ./cmd/server
	@echo "Production build complete: bin/ad-server"

# Run the ad server
run:
	@echo "Starting ad server on port 8080..."
	@go run ./cmd/server/main.go

# Run in development mode with auto-reload (requires air)
dev:
	@echo "Starting ad server in development mode..."
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "air not installed. Install with: go install github.com/cosmtrek/air@latest"; \
		echo "Falling back to standard run..."; \
		go run ./cmd/server/main.go; \
	fi

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	@go test -cover ./...
	@go test -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Install dependencies
install:
	@echo "Installing dependencies..."
	@go mod download
	@go mod tidy
	@echo "Dependencies installed"

# Format code
fmt:
	@echo "Formatting code..."
	@go fmt ./...
	@echo "Code formatted"

# Lint code (requires golangci-lint)
lint:
	@echo "Linting code..."
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed. Install with:"; \
		echo "brew install golangci-lint"; \
	fi

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html
	@echo "Clean complete"

# Check Redis connection
check-redis:
	@echo "Checking Redis connection..."
	@redis-cli ping || echo "Redis not available at localhost:6379"

# Show help
help:
	@echo "Available targets:"
	@echo "  make build          - Build the ad server binary"
	@echo "  make build-prod     - Build optimized production binary"
	@echo "  make run            - Run the ad server"
	@echo "  make dev            - Run with auto-reload (requires air)"
	@echo "  make test           - Run tests"
	@echo "  make test-coverage  - Run tests with coverage report"
	@echo "  make install        - Install dependencies"
	@echo "  make fmt            - Format code"
	@echo "  make lint           - Lint code (requires golangci-lint)"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make check-redis    - Check Redis connection"
	@echo "  make help           - Show this help message"
