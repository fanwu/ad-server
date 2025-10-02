# Ad Server (Go)

High-performance ad serving engine built with Go and Redis for sub-10ms ad request response times.

## Architecture

- **Language**: Go 1.21+
- **Framework**: Gin (HTTP)
- **Data Store**: Redis (primary store for ad decisions)
- **Performance Target**: <10ms p99 latency, 10,000+ req/sec

## Features

- Real-time ad selection from active campaigns
- Redis-first architecture for ultra-low latency
- Campaign filtering by date range and budget
- Random creative selection
- Impression tracking
- Request/impression counters

## Project Structure

```
ad-server/
├── cmd/
│   └── server/          # Main application entry point
│       └── main.go
├── internal/
│   ├── handlers/        # HTTP request handlers
│   ├── models/          # Data models
│   ├── redis/           # Redis client wrapper
│   └── services/        # Business logic
├── bin/                 # Compiled binaries
├── go.mod              # Go module definition
└── go.sum              # Dependency checksums
```

## Redis Data Model

The ad server uses Redis as the primary data store with the following structure:

```
# Active campaigns (sorted by remaining budget)
ZSET active_campaigns → campaign_id:score

# Campaign metadata
HASH campaign:{id} → {name, status, budget_total, budget_spent, start_date, end_date}

# Campaign's creatives
SET campaign:{id}:creatives → {creative_id1, creative_id2, ...}

# Creative metadata
HASH creative:{id} → {name, video_url, duration, format, status}

# Request counters (hourly)
INCR campaign:{id}:requests:{YYYYMMDDHH}

# Impression counters (hourly)
INCR creative:{id}:impressions:{YYYYMMDDHH}
```

## API Endpoints

### Health Check
```
GET /health
```

### Ad Request
```
POST /api/v1/ad-request
Content-Type: application/json

{
  "device_id": "device-123",
  "device_type": "ctv",
  "app_id": "app-456"
}

Response:
{
  "ad_id": "uuid",
  "campaign_id": "uuid",
  "creative_id": "uuid",
  "video_url": "https://...",
  "duration": 30,
  "format": "mp4",
  "tracking_url": "/api/v1/impression",
  "timestamp": "2025-10-01T..."
}
```

### Track Impression
```
POST /api/v1/impression
Content-Type: application/json

{
  "ad_id": "uuid",
  "campaign_id": "uuid",
  "creative_id": "uuid",
  "device_id": "device-123",
  "duration": 30,
  "completed": true
}

Response:
{
  "status": "success",
  "message": "Impression tracked"
}
```

## Development

### Prerequisites

- Go 1.21 or higher
- Redis 7.x running on localhost:6379

### Build

```bash
go build -o bin/ad-server ./cmd/server
```

### Run

```bash
# Development (default port 8080)
go run ./cmd/server/main.go

# Production
./bin/ad-server

# Custom port
PORT=9000 go run ./cmd/server/main.go

# Custom Redis
REDIS_ADDR=redis:6379 REDIS_PASSWORD=secret go run ./cmd/server/main.go
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `REDIS_ADDR` | `localhost:6379` | Redis server address |
| `REDIS_PASSWORD` | `` | Redis password (optional) |

## Testing

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run tests with verbose output
go test -v ./...
```

## Performance

**Target Metrics:**
- P99 latency: <10ms
- Throughput: 10,000+ requests/second
- Redis hit rate: 100% (Redis is primary store)

**Optimization Strategies:**
- Redis connection pooling (100 connections)
- In-memory filtering (Go is fast enough)
- Async counter increments
- No database calls during ad selection

## Data Sync

Campaign and creative data is synced from PostgreSQL to Redis by the Node.js API Gateway every 10 seconds. The ad server only reads from Redis, never from PostgreSQL.

## Deployment

### Docker

```bash
# Build image
docker build -t ad-server .

# Run container
docker run -p 8080:8080 \
  -e REDIS_ADDR=redis:6379 \
  ad-server
```

### Production

For production deployment:
1. Build optimized binary: `go build -ldflags="-s -w" -o bin/ad-server ./cmd/server`
2. Deploy to EKS or EC2
3. Configure Redis connection to ElastiCache
4. Set appropriate resource limits
5. Enable monitoring and logging

## Monitoring

The ad server logs:
- Request latency per ad request
- Campaign/creative selected
- Redis connection status
- Error rates

## Next Steps (Post-MVP)

- [ ] Advanced targeting (geo, device, demographic)
- [ ] Frequency capping
- [ ] Budget pacing algorithms
- [ ] Competitive separation
- [ ] A/B testing support
- [ ] Real-time bidding integration
