# Phase 2 Detailed Development Plan
## Enhanced Features & Advanced Functionality

### Overview
Phase 2 builds upon the MVP foundation to add sophisticated features that differentiate the CTV ad server in the market, including advanced targeting, optimization, and real-time capabilities.

**Prerequisites:** Phase 1 MVP completed and deployed
**Duration:** 8-10 weeks
**Focus:** Advanced features that were deferred from MVP

---

## Phase 2 Feature Set

### What Phase 2 Adds (Beyond MVP)

| MVP (Phase 1) | Phase 2 Enhancement |
|---------------|---------------------|
| Basic campaigns (name, budget, dates) | Advanced campaign settings with pacing, goals |
| Simple creative upload (MP4 only) | Multi-format support (VAST, VPAID, HLS) |
| No targeting | Comprehensive targeting system |
| Basic ad serving | Intelligent ad selection with optimization |
| Simple impression tracking | Full analytics and attribution |
| Manual campaign management | Automated optimization and pacing |
| Single pod ads | Pod assembly with multiple ads |
| No frequency limits | User and device frequency capping |
| No competitive separation | Category-based competitive exclusion |

---

## Technical Architecture Evolution

### Current MVP Architecture (Phase 1)
```
Client → API Gateway → PostgreSQL/Redis → S3
```

### Phase 2 Enhanced Architecture
```
Client → API Gateway → Decision Engine → PostgreSQL/Redis
                ↓
         Targeting Service
                ↓
         Analytics Pipeline → Data Warehouse
                ↓
         Optimization Service
```

---

## Database Schema Enhancements

### New Tables for Phase 2

```sql
-- Targeting Rules (Complex)
CREATE TABLE targeting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Geographic targeting
    geo_countries JSONB,  -- ["US", "CA", "UK"]
    geo_regions JSONB,    -- ["US-CA", "US-NY"]
    geo_cities JSONB,     -- ["Los Angeles", "New York"]
    geo_dma_codes JSONB,  -- ["501", "803"] (DMA codes)

    -- Device targeting
    device_types JSONB,   -- ["smart_tv", "roku", "fire_tv"]
    os_types JSONB,       -- ["android_tv", "tvos", "webos"]
    device_brands JSONB,  -- ["samsung", "lg", "sony"]

    -- Content targeting
    content_categories JSONB, -- ["sports", "news", "entertainment"]
    content_genres JSONB,     -- ["action", "comedy", "drama"]
    content_ratings JSONB,    -- ["G", "PG", "PG-13", "R"]

    -- Audience targeting
    age_ranges JSONB,     -- [{"min": 18, "max": 34}, {"min": 35, "max": 54}]
    gender VARCHAR(20),   -- male, female, all
    household_income JSONB, -- {"min": 50000, "max": 100000}

    -- Time targeting
    time_zones JSONB,     -- ["America/New_York", "America/Los_Angeles"]
    day_parts JSONB,      -- [{"start": "06:00", "end": "12:00"}]
    days_of_week JSONB,   -- [1, 2, 3, 4, 5] (Monday=1)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Frequency Capping
CREATE TABLE frequency_caps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    creative_id UUID REFERENCES creatives(id),

    max_impressions_per_hour INTEGER,
    max_impressions_per_day INTEGER,
    max_impressions_per_week INTEGER,
    max_impressions_per_month INTEGER,

    scope VARCHAR(20) DEFAULT 'user', -- user, device, household, ip

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Frequency Tracking
CREATE TABLE user_frequency_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_identifier VARCHAR(255) NOT NULL, -- hashed user/device ID
    campaign_id UUID REFERENCES campaigns(id),
    creative_id UUID REFERENCES creatives(id),

    impressions_count INTEGER DEFAULT 0,
    last_impression_at TIMESTAMP WITH TIME ZONE,

    hour_count INTEGER DEFAULT 0,
    day_count INTEGER DEFAULT 0,
    week_count INTEGER DEFAULT 0,
    month_count INTEGER DEFAULT 0,

    reset_hour_at TIMESTAMP WITH TIME ZONE,
    reset_day_at TIMESTAMP WITH TIME ZONE,
    reset_week_at TIMESTAMP WITH TIME ZONE,
    reset_month_at TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (user_identifier, campaign_id, creative_id)
);

-- Competitive Categories
CREATE TABLE competitive_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES competitive_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Competitive Categories
CREATE TABLE campaign_competitive_categories (
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    category_id UUID NOT NULL REFERENCES competitive_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (campaign_id, category_id)
);

-- Ad Pods Configuration
CREATE TABLE ad_pods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    max_ads INTEGER DEFAULT 6,
    min_ads INTEGER DEFAULT 1,

    -- Pod rules
    enable_competitive_separation BOOLEAN DEFAULT true,
    min_separation_seconds INTEGER DEFAULT 30,
    allow_duplicate_advertisers BOOLEAN DEFAULT false,

    -- Pod optimization
    optimization_goal VARCHAR(50), -- revenue, fill_rate, user_experience

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Events (for real-time processing)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- impression, click, complete, error
    campaign_id UUID REFERENCES campaigns(id),
    creative_id UUID REFERENCES creatives(id),

    user_identifier VARCHAR(255),
    device_info JSONB,
    geo_info JSONB,

    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Metrics
    view_duration INTEGER, -- seconds watched
    viewability_percentage INTEGER, -- 0-100
    audio_level INTEGER, -- 0-100

    -- Attribution
    attribution_window INTEGER, -- hours
    conversion_value DECIMAL(12,4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Optimization Table
CREATE TABLE campaign_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),

    -- Aggregate metrics (updated hourly)
    total_impressions BIGINT DEFAULT 0,
    total_clicks BIGINT DEFAULT 0,
    total_completions BIGINT DEFAULT 0,

    -- Rates
    ctr DECIMAL(6,4), -- Click-through rate
    vtr DECIMAL(6,4), -- View-through rate
    completion_rate DECIMAL(6,4),

    -- Performance scores
    quality_score DECIMAL(4,2), -- 0-10
    relevance_score DECIMAL(4,2), -- 0-10

    -- Budget pacing
    budget_spent_today DECIMAL(12,2),
    projected_spend_today DECIMAL(12,2),
    pacing_status VARCHAR(20), -- on_track, under, over

    last_calculated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_targeting_campaign ON targeting_rules(campaign_id);
CREATE INDEX idx_targeting_geo ON targeting_rules USING GIN (geo_countries, geo_regions);
CREATE INDEX idx_targeting_device ON targeting_rules USING GIN (device_types);
CREATE INDEX idx_frequency_user ON user_frequency_tracking(user_identifier);
CREATE INDEX idx_analytics_campaign ON analytics_events(campaign_id, event_timestamp);
CREATE INDEX idx_performance_campaign ON campaign_performance(campaign_id);
```

---

## API Enhancements for Phase 2

### Advanced Campaign Management

```javascript
// Targeting APIs
POST   /api/v2/campaigns/:id/targeting      // Set complex targeting rules
GET    /api/v2/campaigns/:id/targeting      // Get targeting configuration
PUT    /api/v2/campaigns/:id/targeting      // Update targeting rules
DELETE /api/v2/campaigns/:id/targeting/:ruleId // Remove specific rule

// Frequency Capping
POST   /api/v2/campaigns/:id/frequency-cap  // Set frequency caps
GET    /api/v2/campaigns/:id/frequency-cap  // Get current caps
PUT    /api/v2/campaigns/:id/frequency-cap  // Update caps

// Competitive Separation
POST   /api/v2/categories                   // Create competitive category
GET    /api/v2/categories                   // List all categories
POST   /api/v2/campaigns/:id/categories     // Assign categories to campaign

// Advanced Ad Serving
POST   /api/v2/ad-request                   // Enhanced ad request with targeting
{
    "request_id": "uuid",
    "pod_duration": 90,  // Request 90-second pod
    "max_ads": 3,
    "user": {
        "id": "hashed_id",
        "age": 35,
        "gender": "male"
    },
    "device": {
        "type": "smart_tv",
        "brand": "samsung",
        "os": "tizen"
    },
    "content": {
        "category": "sports",
        "rating": "PG"
    },
    "geo": {
        "country": "US",
        "region": "CA",
        "city": "Los Angeles",
        "dma": "803"
    }
}

// Analytics & Reporting
GET    /api/v2/analytics/campaigns/:id      // Detailed campaign analytics
GET    /api/v2/analytics/performance        // Performance metrics
GET    /api/v2/analytics/attribution        // Attribution reports
POST   /api/v2/analytics/custom-report      // Generate custom report

// Optimization
GET    /api/v2/optimization/recommendations // AI-based recommendations
POST   /api/v2/optimization/auto-optimize   // Enable auto-optimization
GET    /api/v2/optimization/pacing          // Budget pacing analysis
```

---

## Services Architecture

### New Services for Phase 2

#### 1. Targeting Service
```javascript
class TargetingService {
    // Evaluates if a campaign matches request parameters
    async evaluateCampaign(campaign, requestContext) {
        const rules = await this.getTargetingRules(campaign.id);

        // Geographic matching
        if (!this.matchesGeo(rules.geo, requestContext.geo)) return false;

        // Device matching
        if (!this.matchesDevice(rules.device, requestContext.device)) return false;

        // Audience matching
        if (!this.matchesAudience(rules.audience, requestContext.user)) return false;

        // Time matching
        if (!this.matchesTime(rules.time, requestContext.timestamp)) return false;

        return true;
    }

    // Complex geo matching with DMA codes
    matchesGeo(geoRules, userGeo) {
        // Implement country > region > city > DMA hierarchy
    }
}
```

#### 2. Frequency Capping Service
```javascript
class FrequencyService {
    async checkFrequencyCap(userId, campaignId, creativeId) {
        const caps = await this.getFrequencyCaps(campaignId);
        const tracking = await this.getUserTracking(userId, campaignId);

        // Check hourly cap
        if (caps.max_per_hour && tracking.hour_count >= caps.max_per_hour) {
            return false;
        }

        // Check daily cap
        if (caps.max_per_day && tracking.day_count >= caps.max_per_day) {
            return false;
        }

        return true;
    }

    async incrementFrequency(userId, campaignId, creativeId) {
        // Update all frequency counters
        // Reset counters if time windows expired
    }
}
```

#### 3. Pod Assembly Service
```javascript
class PodAssemblyService {
    async assemblePod(duration, requestContext) {
        const eligibleCampaigns = await this.getEligibleCampaigns(requestContext);

        // Apply competitive separation
        const separated = this.applyCompetitiveSeparation(eligibleCampaigns);

        // Optimize pod fill
        const optimizedPod = this.optimizePod(separated, duration);

        // Apply frequency caps
        const finalPod = await this.applyFrequencyCaps(optimizedPod, requestContext.userId);

        return finalPod;
    }
}
```

#### 4. Analytics Pipeline
```javascript
class AnalyticsPipeline {
    async processEvent(event) {
        // Real-time processing
        await this.updateRealTimeMetrics(event);

        // Stream to data warehouse
        await this.streamToWarehouse(event);

        // Update cache for fast retrieval
        await this.updateMetricsCache(event);

        // Trigger alerts if needed
        await this.checkAlertConditions(event);
    }
}
```

---

## Implementation Timeline

### Week 1-2: Targeting System
- [ ] Database schema for targeting rules
- [ ] Targeting service implementation
- [ ] Geographic targeting with DMA codes
- [ ] Device and OS targeting
- [ ] Audience demographic targeting
- [ ] Time-based targeting
- [ ] Comprehensive testing

### Week 3-4: Frequency Capping
- [ ] Frequency cap database schema
- [ ] User tracking implementation
- [ ] Frequency service logic
- [ ] Time window management
- [ ] Reset mechanisms
- [ ] Integration with ad serving
- [ ] Performance optimization

### Week 5-6: Competitive Separation & Pods
- [ ] Competitive categories management
- [ ] Category assignment to campaigns
- [ ] Pod assembly logic
- [ ] Separation algorithm
- [ ] Pod optimization
- [ ] Testing with various scenarios

### Week 7-8: Analytics & Optimization
- [ ] Analytics events pipeline
- [ ] Real-time metrics processing
- [ ] Performance scoring
- [ ] Budget pacing algorithm
- [ ] Optimization recommendations
- [ ] Custom reporting API

### Week 9-10: Testing & Performance
- [ ] Load testing with targeting
- [ ] Frequency cap stress testing
- [ ] Pod assembly performance
- [ ] Analytics pipeline testing
- [ ] End-to-end integration testing
- [ ] Documentation and training

---

## Performance Requirements

### Latency Targets
- **Ad Request with Targeting:** <50ms
- **Frequency Cap Check:** <10ms
- **Pod Assembly:** <30ms
- **Analytics Event Processing:** <100ms

### Throughput Targets
- **Ad Requests:** 10,000+ per minute
- **Analytics Events:** 100,000+ per minute
- **Campaign Updates:** Real-time propagation

### Accuracy Targets
- **Targeting Accuracy:** 99%+
- **Frequency Cap Accuracy:** 100%
- **Competitive Separation:** 100%
- **Analytics Accuracy:** 99.9%+

---

## Infrastructure Scaling

### Database Optimization
```yaml
PostgreSQL Enhancements:
- Read replicas for targeting queries
- Partitioning for analytics_events table
- Connection pooling optimization
- Query optimization and indexing

Redis Enhancements:
- Redis Cluster for frequency tracking
- Separate cache for targeting rules
- TTL optimization for different data types
```

### Application Scaling
```yaml
Service Scaling:
- Horizontal scaling for targeting service
- Dedicated pods for analytics processing
- Auto-scaling based on load
- Circuit breakers for resilience
```

---

## Testing Strategy

### Unit Testing
- Targeting rule evaluation
- Frequency cap calculations
- Pod assembly algorithms
- Analytics aggregations

### Integration Testing
- End-to-end targeting flow
- Frequency cap with multiple users
- Pod assembly with real data
- Analytics pipeline flow

### Performance Testing
```javascript
// Load test scenarios
const scenarios = {
    targeting: {
        vus: 1000,  // virtual users
        duration: '5m',
        thresholds: {
            http_req_duration: ['p(95)<50']  // 95% under 50ms
        }
    },
    podAssembly: {
        vus: 500,
        duration: '5m',
        thresholds: {
            http_req_duration: ['p(95)<30']
        }
    }
};
```

---

## Success Metrics

### Technical Metrics
- ✅ All targeting rules working correctly
- ✅ Frequency caps enforced accurately
- ✅ Competitive separation 100% effective
- ✅ Pod fill rate >90%
- ✅ Analytics processing <100ms

### Business Metrics
- Campaign performance improvement >20%
- Budget utilization >95%
- User satisfaction score >4.5/5
- Advertiser retention >90%

---

## Migration Strategy

### From MVP to Phase 2

1. **Database Migration**
   - Run new migration scripts
   - Backfill data where needed
   - Test data integrity

2. **API Versioning**
   - Maintain v1 endpoints for MVP
   - Introduce v2 endpoints for new features
   - Gradual migration of clients

3. **Feature Flags**
   ```javascript
   const features = {
       targeting: process.env.ENABLE_TARGETING === 'true',
       frequencyCap: process.env.ENABLE_FREQUENCY_CAP === 'true',
       podAssembly: process.env.ENABLE_POD_ASSEMBLY === 'true'
   };
   ```

4. **Rollout Strategy**
   - 10% traffic to new features
   - Monitor performance and errors
   - Gradual increase to 100%

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Targeting performance impact | Aggressive caching, read replicas |
| Frequency cap accuracy | Redis Cluster, atomic operations |
| Pod assembly complexity | Pre-computation, optimization algorithms |
| Analytics data volume | Stream processing, data partitioning |

### Operational Risks
| Risk | Mitigation |
|------|------------|
| Feature complexity | Phased rollout, feature flags |
| Data migration issues | Comprehensive testing, rollback plan |
| Performance degradation | Monitoring, auto-scaling |
| Integration failures | Circuit breakers, fallback mechanisms |

---

## Phase 2 Completion Criteria

### Must Have
- [x] Complete targeting system with all dimensions
- [x] Frequency capping at user and device level
- [x] Competitive separation working
- [x] Basic pod assembly
- [x] Real-time analytics pipeline
- [x] Performance meeting targets

### Nice to Have
- [ ] Machine learning optimization
- [ ] Predictive pacing
- [ ] Advanced attribution models
- [ ] A/B testing framework

---

## Transition to Phase 3

After Phase 2 completion, the system will be ready for:
- **Phase 3:** Enterprise features (RTB, programmatic, exchanges)
- **Phase 4:** Machine learning and AI optimization
- **Phase 5:** Global scale and multi-region deployment

---

*Created: September 29, 2024*
*Phase 2 Target Start: November 2024 (post-MVP)*
*Phase 2 Target Completion: January 2025*