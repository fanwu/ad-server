# CTV Ad Server Development Plan

## Project Overview

This document outlines the development plan for building a simplified Connected TV (CTV) ad server. The goal is to create a production-ready ad serving platform that handles core advertising functions without the complexity of Server-Side Ad Insertion (SSAI) or Dynamic Ad Insertion (DAI).

## Project Scope

### What We're Building
- **Core Ad Decision Engine** - Real-time ad selection and targeting
- **Campaign Management System** - Campaign, creative, and targeting management
- **VAST Tag Generation** - Industry-standard ad response format
- **Tracking & Analytics** - Impression tracking and reporting
- **Creative Management** - Video asset storage and delivery
- **Ad Pod Management** - Commercial break optimization

### What We're NOT Building (Initially)
- **Server-Side Ad Insertion (SSAI)** - Stream stitching functionality
- **Dynamic Ad Insertion (DAI)** - Real-time content replacement
- **Live Stream Integration** - Focus on VOD initially
- **Advanced ML/AI Features** - Basic targeting initially

## Core Features & Requirements

### 1. Ad Serving Features
- **VAST 4.x Compliance** - Standard video ad serving template
- **Real-time Ad Selection** - Sub-100ms response times
- **Multiple Ad Formats** - Linear video ads (MP4, WebM)
- **Ad Pod Support** - Structured commercial breaks

### 2. Targeting & Optimization
- **Frequency Capping** - Prevent ad fatigue
- **Competitive Separation** - No competing brands in same pod
- **Deduplication** - No repeated ads in same session
- **Geographic Targeting** - Country/region/city level
- **Device Targeting** - Platform, OS, device type
- **Content Targeting** - Genre, content category

### 3. Campaign Management
- **Campaign Lifecycle** - Create, schedule, pause, optimize
- **Budget Management** - Daily/total budget pacing
- **Creative Management** - Upload, validate, approve
- **Targeting Rules** - Flexible targeting configuration
- **Reporting Dashboard** - Real-time performance metrics

### 4. Analytics & Tracking
- **Impression Tracking** - VAST-compliant tracking pixels
- **Viewability Metrics** - Start, quartiles, completion
- **Performance Analytics** - CTR, completion rates, reach
- **Frequency Analysis** - User-level exposure tracking
- **Revenue Reporting** - Campaign performance and ROI

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin UI      │    │   Player Apps   │    │  Analytics UI   │
│  (React/Vue)    │    │  (CTV Devices)  │    │   (Dashboards)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (Kong/Express)                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Campaign      │    │   Ad Decision   │    │   Tracking      │
│   Management    │    │     Engine      │    │   Service       │
│   Service       │    │   (Go/Rust)     │    │  (Node.js/Go)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Redis       │    │   ClickHouse    │
│  (Campaigns)    │    │   (Caching)     │    │  (Analytics)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│      CDN        │    │   File Storage  │
│  (CloudFront)   │    │   (AWS S3)      │
└─────────────────┘    └─────────────────┘
```

### Core Components

1. **API Gateway**
   - Request routing and rate limiting
   - Authentication and authorization
   - Load balancing

2. **Ad Decision Engine**
   - Real-time ad selection logic
   - Targeting rule evaluation
   - Frequency cap enforcement
   - VAST response generation

3. **Campaign Management Service**
   - CRUD operations for campaigns
   - Creative upload and validation
   - Targeting rule configuration
   - Budget management

4. **Tracking Service**
   - Impression pixel handling
   - Event collection and processing
   - Real-time analytics pipeline

5. **Creative Management**
   - Video asset storage
   - CDN integration
   - Format validation

## Development Phases

### Phase 1: Foundation & Infrastructure (Months 1-2)

#### Project 1.1: Database Design & Setup
**Duration:** 3 weeks
**Tech Stack:** PostgreSQL, Prisma/SQLAlchemy

**Deliverables:**
- Complete database schema design
- Migration scripts
- Data models and relationships
- Initial seed data

**Key Tables:**
```sql
-- Core campaign management
campaigns (id, name, advertiser_id, budget, start_date, end_date, status)
creatives (id, campaign_id, video_url, duration, mime_type, file_size)
targeting_rules (id, campaign_id, geo_targets, device_targets, content_categories)
frequency_caps (id, campaign_id, max_impressions, time_window)

-- Ad serving
ad_pods (id, content_id, duration, max_ads, competitive_separation_rules)
ad_requests (id, timestamp, content_id, device_info, geo_info, user_id)

-- Tracking and analytics
impressions (id, creative_id, timestamp, device_id, ip_address, user_agent)
events (id, impression_id, event_type, timestamp, additional_data)
```

#### Project 1.2: API Gateway & Authentication
**Duration:** 2 weeks
**Tech Stack:** Node.js/Express or Go/Gin, JWT, Redis

**Deliverables:**
- RESTful API foundation
- JWT-based authentication
- Rate limiting and request validation
- Basic monitoring and logging

**API Endpoints:**
```
# Campaign Management
POST /api/v1/campaigns
GET /api/v1/campaigns
PUT /api/v1/campaigns/{id}
DELETE /api/v1/campaigns/{id}

# Ad Serving
GET /api/v1/ads/vast?content_id={}&device={}&geo={}
POST /api/v1/track/impression
POST /api/v1/track/event

# Analytics
GET /api/v1/analytics/campaigns/{id}/metrics
GET /api/v1/analytics/reports
```

### Phase 2: Campaign Management System (Months 3-4)

#### Project 2.1: Campaign Management Backend
**Duration:** 4 weeks
**Tech Stack:** Node.js/TypeScript or Python/FastAPI

**Deliverables:**
- Complete campaign CRUD operations
- Creative upload and validation
- Targeting rule engine
- Budget allocation and pacing logic

**Features:**
- Campaign lifecycle management
- Creative asset validation (duration, format, file size)
- Flexible targeting configuration
- Budget pacing algorithms
- Approval workflow

#### Project 2.2: Admin Dashboard Frontend
**Duration:** 4 weeks
**Tech Stack:** React/Next.js, Tailwind CSS, Zustand

**Deliverables:**
- Campaign creation and management UI
- Creative upload interface
- Targeting configuration forms
- Real-time campaign monitoring
- Basic reporting dashboards

**Key UI Components:**
- Campaign wizard for easy setup
- Drag-and-drop creative upload
- Interactive targeting map
- Real-time performance charts
- Budget pacing visualization

### Phase 3: Ad Decision Engine (Months 5-6)

#### Project 3.1: Core Ad Selection Logic
**Duration:** 6 weeks
**Tech Stack:** Go or Rust, Redis, PostgreSQL

**Deliverables:**
- Real-time ad selection algorithm
- Targeting rule evaluation engine
- Frequency capping system
- Competitive separation logic
- Basic auction mechanism

**Core Algorithm:**
```go
func SelectAds(request AdRequest) VastResponse {
    // 1. Filter eligible campaigns
    eligibleCampaigns := filterCampaigns(request)

    // 2. Apply targeting rules
    targetedCampaigns := applyTargeting(eligibleCampaigns, request)

    // 3. Check frequency caps
    validCampaigns := checkFrequencyCaps(targetedCampaigns, request.UserID)

    // 4. Apply competitive separation
    selectedAds := selectWithSeparation(validCampaigns, request.PodConfig)

    // 5. Generate VAST response
    return generateVastResponse(selectedAds)
}
```

#### Project 3.2: VAST Response Generation
**Duration:** 2 weeks
**Tech Stack:** XML templating, Go/Node.js

**Deliverables:**
- VAST 4.2 compliant XML generation
- Support for linear video ads
- Tracking pixel embedding
- Error handling and fallbacks

**VAST Template Structure:**
```xml
<VAST version="4.2">
  <Ad id="{{campaign_id}}">
    <InLine>
      <AdSystem>{{ad_server_name}}</AdSystem>
      <AdTitle>{{campaign_name}}</AdTitle>
      <Impression>{{impression_tracking_url}}</Impression>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>{{duration}}</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4">
                {{creative_url}}
              </MediaFile>
            </MediaFiles>
            <TrackingEvents>
              <Tracking event="start">{{start_tracking_url}}</Tracking>
              <Tracking event="firstQuartile">{{quartile_tracking_url}}</Tracking>
              <Tracking event="midpoint">{{midpoint_tracking_url}}</Tracking>
              <Tracking event="thirdQuartile">{{quartile_tracking_url}}</Tracking>
              <Tracking event="complete">{{complete_tracking_url}}</Tracking>
            </TrackingEvents>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>
```

### Phase 4: Tracking & Analytics (Months 7-8)

#### Project 4.1: Impression Tracking System
**Duration:** 4 weeks
**Tech Stack:** Node.js/Go, Kafka/RabbitMQ, ClickHouse

**Deliverables:**
- High-throughput tracking pixel endpoint
- Event collection and processing pipeline
- Real-time data ingestion
- Data validation and deduplication

**Event Processing Pipeline:**
```
Tracking Pixel → API Gateway → Message Queue → Stream Processor → ClickHouse
     1ms              5ms           10ms             100ms          500ms
```

#### Project 4.2: Analytics & Reporting
**Duration:** 4 weeks
**Tech Stack:** ClickHouse, Python/FastAPI, React

**Deliverables:**
- Real-time campaign metrics
- Performance analytics dashboard
- Frequency analysis reports
- Revenue and ROI tracking
- Data export functionality

**Key Metrics:**
- Impressions, Reach, Frequency
- Completion Rate, CTR
- CPM, Revenue, ROAS
- Viewability Score
- Audience Demographics

### Phase 5: Creative Management & CDN (Month 9)

#### Project 5.1: Creative Storage System
**Duration:** 3 weeks
**Tech Stack:** AWS S3/MinIO, FFmpeg, CDN

**Deliverables:**
- Video upload and validation system
- Creative approval workflow
- CDN integration for fast delivery
- Multiple format support

#### Project 5.2: Ad Pod Management
**Duration:** 1 week
**Tech Stack:** Integration with Ad Decision Engine

**Deliverables:**
- Pod configuration management
- Deduplication logic
- Competitive separation enforcement
- Dynamic pod optimization

### Phase 6: Integration & Testing (Month 10)

#### Project 6.1: System Integration
**Duration:** 2 weeks

**Deliverables:**
- End-to-end integration testing
- API documentation
- Third-party integrations (analytics, verification)
- Performance optimization

#### Project 6.2: Testing & QA
**Duration:** 2 weeks

**Deliverables:**
- Comprehensive test suite
- Load testing (10k+ requests/sec)
- VAST validator compliance
- Security testing
- Documentation

## Technical Stack Recommendations

### Backend Services
| Component | Primary Choice | Alternative | Justification |
|-----------|---------------|-------------|---------------|
| Ad Decision Engine | **Go** | Rust | High concurrency, low latency |
| Campaign Management | **Node.js/TypeScript** | Python/FastAPI | Rapid development, good ecosystem |
| Tracking Service | **Go** | Node.js | High throughput, memory efficiency |
| API Gateway | **Kong** | Custom Express | Production-ready features |

### Data Layer
| Component | Choice | Justification |
|-----------|--------|---------------|
| Primary Database | **PostgreSQL** | ACID compliance, JSON support |
| Caching | **Redis** | Fast frequency cap lookups |
| Analytics DB | **ClickHouse** | Column-store for analytics queries |
| Message Queue | **Apache Kafka** | High-throughput event streaming |

### Frontend & Infrastructure
| Component | Choice | Justification |
|-----------|--------|---------------|
| Admin UI | **React + Next.js** | Rich ecosystem, SSR support |
| UI Library | **Tailwind CSS + shadcn/ui** | Consistent, customizable design |
| State Management | **Zustand** | Simple, performant |
| Container Platform | **Docker + Kubernetes** | Scalable, cloud-native |
| CDN | **CloudFront** | Global edge locations |
| Monitoring | **Prometheus + Grafana** | Industry standard |

## Performance Requirements

### Ad Serving
- **Response Time:** <100ms for ad decisions
- **Throughput:** 10,000+ requests per second
- **Availability:** 99.9% uptime
- **Global Latency:** <50ms from edge locations

### Tracking
- **Ingestion Rate:** 100,000+ events per second
- **Data Retention:** 2 years for analytics
- **Real-time Processing:** <1 second lag for dashboard updates

### Storage
- **Creative Storage:** Unlimited with CDN distribution
- **Database Performance:** <10ms query response time
- **Backup:** Automated daily backups with point-in-time recovery

## Success Metrics

### Technical Metrics
- Ad decision response time <100ms (95th percentile)
- System uptime >99.9%
- Tracking accuracy >99.5%
- VAST compliance score 100%

### Business Metrics
- Campaign delivery accuracy >95%
- Frequency cap compliance >99%
- Revenue reconciliation accuracy >99.9%
- Customer satisfaction score >4.5/5

## Risk Assessment & Mitigation

### High-Risk Areas
1. **Ad Decision Performance** - Critical for user experience
   - *Mitigation:* Extensive load testing, caching strategies
2. **Data Accuracy** - Essential for billing and reporting
   - *Mitigation:* Data validation, reconciliation processes
3. **VAST Compliance** - Required for integration
   - *Mitigation:* Automated testing with IAB validators

### Medium-Risk Areas
1. **Scalability** - Future growth requirements
   - *Mitigation:* Microservices architecture, horizontal scaling
2. **Security** - Ad fraud and data protection
   - *Mitigation:* Security audits, fraud detection systems

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1** | Months 1-2 | Database, API Gateway, Authentication |
| **Phase 2** | Months 3-4 | Campaign Management, Admin UI |
| **Phase 3** | Months 5-6 | Ad Decision Engine, VAST Generation |
| **Phase 4** | Months 7-8 | Tracking System, Analytics |
| **Phase 5** | Month 9 | Creative Management, CDN |
| **Phase 6** | Month 10 | Integration, Testing, Launch |

**Total Timeline:** 10 months to MVP launch
**Team Size:** 4-6 developers (2 backend, 1 frontend, 1 devops, 1 data engineer, 1 QA)

## Next Steps

1. **Project Setup**
   - Initialize git repository
   - Set up development environment
   - Create project structure

2. **Team Formation**
   - Define roles and responsibilities
   - Set up communication channels
   - Establish development workflows

3. **Environment Setup**
   - Development, staging, production environments
   - CI/CD pipeline configuration
   - Monitoring and alerting setup

4. **Phase 1 Kickoff**
   - Detailed database design
   - API specification
   - Development sprint planning

---

*This document will be updated as the project progresses and requirements evolve.*