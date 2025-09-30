# CTV Ad Server MVP Plan

## 🎯 MVP Vision

**Goal**: Create a minimal but functional CTV ad server that demonstrates core advertising capabilities with proper testing and AWS deployment.

**Timeline**: 3-4 weeks
**Focus**: Speed to market with essential features only
**Quality**: Maintain testing standards and deployment automation

---

## ✨ MVP Core Features (Minimal Viable Product)

### What's INCLUDED in MVP

#### 1. **Basic Campaign Management** ⭐
- Create campaigns with basic info (name, budget, dates)
- List and view campaigns
- Start/pause campaigns
- **Skip**: Complex targeting, competitive separation, advanced budget controls

#### 2. **Simple Creative Management** ⭐
- Upload video creatives (MP4 only)
- Basic creative validation (file size, duration)
- Link creatives to campaigns
- **Skip**: Multiple formats, approval workflows, thumbnails

#### 3. **Basic Ad Serving** ⭐
- Simple ad request endpoint
- Return available ads based on campaign status
- Basic impression tracking
- **Skip**: Complex targeting, RTB, pod assembly, frequency capping

#### 4. **Essential Analytics** ⭐
- Campaign impressions count
- Basic performance metrics
- Simple dashboard data
- **Skip**: Advanced analytics, ML, detailed reporting

#### 5. **AWS Deployment** ⭐
- Complete AWS infrastructure setup
- Automated deployment scripts
- Production-ready environment
- **Skip**: Auto-scaling, advanced monitoring, multi-region

### What's EXCLUDED from MVP (Phase 2+)

❌ **Advanced Targeting**: Geographic, device, demographic targeting
❌ **Frequency Capping**: User/device level restrictions
❌ **Competitive Separation**: Category-based exclusions
❌ **Pod Assembly**: Multiple ads per break
❌ **Real-Time Bidding**: OpenRTB protocol
❌ **Advanced Analytics**: ML models, predictive analytics
❌ **Multi-Format Support**: Display ads, audio ads
❌ **User Management**: Multiple users, roles, permissions (keep single admin)

---

## 🛠️ MVP Technology Stack

### Core Services Architecture
Following the original plan but with simplified configuration:

| Service | Technology | Alternative | MVP Rationale |
|---------|------------|-------------|---------------|
| **API Gateway** | **Node.js/Express** | Kong | Faster development, existing codebase |
| **Ad Decision Engine** | **Go** | Rust | High performance, low latency (same as full plan) |
| **Campaign Management** | **Node.js/TypeScript** | Python | Rapid development, consistent with gateway |

### Data Layer
| Component | Technology | MVP Justification |
|-----------|------------|-------------------|
| **Primary Database** | **PostgreSQL 15** | Already implemented, ACID compliance |
| **Caching** | **Redis 7** | Already implemented, session management |
| **File Storage** | **AWS S3** | Creative assets, proven scalability |

### Infrastructure & Development
| Component | Technology | MVP Configuration |
|-----------|------------|-------------------|
| **Container Platform** | **Docker + EKS** | Simplified single-node setup |
| **CI/CD** | **GitHub Actions** | Already implemented and working |
| **Testing** | **Jest** | Comprehensive test suite (194 tests) |
| **Monitoring** | **CloudWatch** | Basic AWS monitoring |

### Key Simplifications for MVP
- **Ad Decision Engine**: Keep Go for performance but minimal targeting logic
- **No Complex Microservices**: Fewer services, simpler communication
- **Single Database**: No analytics DB separation initially
- **Basic Infrastructure**: Single region, minimal auto-scaling

---

## 📊 MVP Database Schema (Simplified)

### Core Tables Only

```sql
-- Keep existing users table (already implemented)
-- Simplify campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    budget_total DECIMAL(12,2) NOT NULL CHECK (budget_total > 0),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simplified creatives table
CREATE TABLE creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    video_url VARCHAR(500) NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0), -- in seconds
    file_size BIGINT, -- in bytes
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic ad serving tracking
CREATE TABLE ad_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE impressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES ad_requests(id),
    campaign_id UUID REFERENCES campaigns(id),
    creative_id UUID REFERENCES creatives(id),
    served_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_creatives_campaign_id ON creatives(campaign_id);
CREATE INDEX idx_impressions_campaign_id ON impressions(campaign_id);
```

**Removed Complexity**:
- No targeting rules tables
- No frequency capping tables
- No competitive categories
- No ad pods configuration
- No complex JSONB fields

---

## 🔌 MVP API Endpoints (Essential Only)

### Core MVP Endpoints

```javascript
// Campaign Management (Simplified)
POST   /api/v1/campaigns                    // Create campaign (basic fields only)
GET    /api/v1/campaigns                    // List campaigns
GET    /api/v1/campaigns/:id               // Get campaign details
PUT    /api/v1/campaigns/:id/status        // Update campaign status only
DELETE /api/v1/campaigns/:id               // Delete campaign

// Creative Management (Basic)
POST   /api/v1/campaigns/:id/creatives     // Upload creative (MP4 only)
GET    /api/v1/campaigns/:id/creatives     // List creatives for campaign
DELETE /api/v1/creatives/:id               // Delete creative

// Ad Serving (MVP)
POST   /api/v1/ad-request                  // Request ad (no targeting)
POST   /api/v1/impression                  // Track impression

// Basic Analytics
GET    /api/v1/campaigns/:id/stats         // Basic campaign stats
GET    /api/v1/dashboard                   // Simple dashboard data

// Keep existing auth endpoints
POST   /api/v1/auth/login                  // Login
POST   /api/v1/auth/logout                 // Logout
GET    /api/v1/auth/profile                // Profile
```

**Simplified Request/Response Examples**:

```javascript
// Create Campaign (MVP)
POST /api/v1/campaigns
{
    "name": "Summer Sale Campaign",
    "description": "Basic summer promotion",
    "budget_total": 5000.00,
    "start_date": "2024-10-01T00:00:00Z",
    "end_date": "2024-10-31T23:59:59Z"
}

// Ad Request (MVP - no targeting)
POST /api/v1/ad-request
{
    "request_id": "req_12345",
    "duration": 30  // Requested ad duration in seconds
}

// Response
{
    "campaign_id": "uuid",
    "creative_id": "uuid",
    "video_url": "https://cdn.example.com/creative.mp4",
    "duration": 30
}
```

---

## 🧪 MVP Testing Strategy

### Testing Scope (Maintain Quality)

#### Unit Tests (Target: >90% coverage)
- ✅ Campaign CRUD operations
- ✅ Creative management
- ✅ Ad serving logic
- ✅ Basic analytics calculations
- ✅ Database operations

#### Integration Tests
- ✅ Campaign creation flow
- ✅ Creative upload flow
- ✅ Ad serving flow
- ✅ Impression tracking
- ✅ Basic analytics endpoints

#### Load Tests (Basic)
- ✅ 100 concurrent ad requests
- ✅ Campaign management operations
- ✅ Database performance under load

#### Security Tests
- ✅ Authentication still required
- ✅ Input validation
- ✅ File upload security
- ✅ SQL injection prevention

**Simplified Test Data**:
```javascript
// MVP test data structure
const mvpTestData = {
    campaigns: [
        {
            name: "Test Campaign 1",
            budget_total: 1000.00,
            start_date: "2024-10-01T00:00:00Z",
            end_date: "2024-10-31T23:59:59Z"
        }
    ],
    creatives: [
        {
            name: "Test Creative 30s",
            video_url: "https://example.com/test.mp4",
            duration: 30,
            file_size: 5000000
        }
    ]
};
```

---

## ☁️ MVP AWS Infrastructure (Production Ready)

### AWS Services for MVP

#### Essential Services Only
```yaml
Core Infrastructure:
- VPC with public/private subnets
- EKS cluster (single node group)
- RDS PostgreSQL (single instance)
- ElastiCache Redis (single node)
- S3 bucket for creatives
- CloudFront for creative delivery
- Application Load Balancer
- Route53 for DNS

Monitoring (Basic):
- CloudWatch for logs and metrics
- Basic health checks

Security:
- SSL certificates via ACM
- Security groups
- IAM roles and policies
```

#### Terraform Configuration (Simplified)

**File: `infrastructure/terraform/mvp.tf`**
```hcl
# MVP-specific infrastructure
locals {
    mvp_config = {
        environment = "mvp"
        instance_size = "small"  # t3.small instead of t3.medium
        node_count = 1           # Single node instead of 2-3
        db_instance = "db.t3.micro"
        redis_node = "cache.t3.micro"
    }
}

# Simplified EKS - single node group
resource "aws_eks_node_group" "mvp" {
    cluster_name    = aws_eks_cluster.main.name
    node_group_name = "mvp-nodes"
    node_role_arn   = aws_iam_role.node_group.arn
    subnet_ids      = var.private_subnet_ids

    instance_types = ["t3.small"]

    scaling_config {
        desired_size = 1
        max_size     = 2
        min_size     = 1
    }
}
```

#### Deployment Scripts (MVP)

**File: `scripts/deploy-mvp.sh`**
```bash
#!/bin/bash
set -e

echo "🚀 Deploying CTV Ad Server MVP to AWS"

# Build and push MVP services
docker build -t ctv-api-gateway services/api-gateway/
docker build -t ctv-ad-decision services/ad-decision-engine/
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
docker tag ctv-api-gateway:latest $ECR_REGISTRY/ctv-api-gateway:latest
docker tag ctv-ad-decision:latest $ECR_REGISTRY/ctv-ad-decision:latest
docker push $ECR_REGISTRY/ctv-api-gateway:latest
docker push $ECR_REGISTRY/ctv-ad-decision:latest

# Deploy infrastructure
cd infrastructure/terraform
terraform workspace select mvp || terraform workspace new mvp
terraform apply -var="environment=mvp" -auto-approve

# Deploy application
kubectl apply -f ../k8s/mvp/

echo "✅ MVP Deployment Complete!"
echo "🌐 URL: $(kubectl get ingress mvp-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
```

---

## ⚡ MVP Development Timeline

### Week 1: Database & Basic API (Oct 1-7)
**Days 1-2: Database Schema**
- Create simplified migration files
- Remove complex tables and relationships
- Test basic CRUD operations

**Days 3-5: Campaign Management**
- Implement simplified campaign endpoints
- Basic validation and error handling
- Unit tests for campaign operations

**Days 6-7: Creative Management**
- File upload for MP4 videos
- Basic file validation
- Link creatives to campaigns

### Week 2: Ad Serving & Testing (Oct 8-14)
**Days 1-3: Ad Serving Logic & Decision Engine**
- Implement Go-based ad decision engine (minimal version)
- Simple ad request/response endpoints
- Basic impression tracking
- No targeting - just return available ads based on campaign status

**Days 4-5: Testing Implementation**
- Comprehensive test suite for MVP features
- Integration tests for full flow
- Performance testing setup

**Days 6-7: Basic Analytics**
- Campaign impression counts
- Simple dashboard endpoint
- Basic performance metrics

### Week 3: AWS Infrastructure (Oct 15-21)
**Days 1-3: Infrastructure Setup**
- Terraform configuration for MVP
- Simplified AWS architecture
- Basic monitoring and logging

**Days 4-5: Deployment Automation**
- CI/CD pipeline for MVP
- Automated deployment scripts
- Environment configuration

**Days 6-7: Testing & Validation**
- End-to-end testing in AWS
- Performance validation
- Security testing

### Week 4: Polish & Demo Prep (Oct 22-28)
**Days 1-3: Bug Fixes & Optimization**
- Address any issues found in testing
- Performance optimization
- Error handling improvements

**Days 4-5: Documentation**
- MVP API documentation
- Deployment guide
- Demo preparation

**Days 6-7: Final Testing & Launch**
- Final integration testing
- Load testing validation
- MVP launch preparation

---

## ✅ MVP Success Criteria

### Technical Requirements
- **Response Time**: Ad requests <100ms
- **Uptime**: 99%+ availability
- **Throughput**: 500+ ad requests per minute
- **Test Coverage**: >90% for MVP features

### Functional Requirements
- ✅ Create and manage campaigns
- ✅ Upload and manage video creatives
- ✅ Serve ads via API
- ✅ Track basic impressions
- ✅ View campaign performance
- ✅ Deploy and run in AWS

### Demo Capabilities
1. **Campaign Creation**: Create a campaign in <2 minutes
2. **Creative Upload**: Upload video creative successfully
3. **Ad Serving**: Request and receive ads via API
4. **Analytics**: View campaign performance metrics
5. **Scale**: Handle multiple concurrent requests

---

## 🔄 MVP to Full Product Migration Plan

### Phase 2: Add Advanced Features (Post-MVP)
- **Targeting System**: Geographic, device, demographic
- **Frequency Capping**: User/device level controls
- **Advanced Analytics**: Detailed reporting and insights
- **Multi-Format**: Display ads, different video formats
- **Optimization**: Performance improvements and caching

### Phase 3: Enterprise Features
- **Real-Time Bidding**: OpenRTB integration
- **Advanced Targeting**: ML-based audience segments
- **Multi-Region**: Global deployment
- **Enterprise Security**: SOC2 compliance

---

## 📋 MVP Development Checklist

### Pre-Development
- [ ] Review and approve MVP scope
- [ ] Set up MVP branch in git
- [ ] Configure MVP environment variables
- [ ] Plan MVP test data and scenarios

### Development Phase
- [ ] Implement simplified database schema
- [ ] Build MVP API endpoints
- [ ] Create comprehensive test suite
- [ ] Set up AWS infrastructure
- [ ] Implement deployment automation

### Testing Phase
- [ ] Unit test coverage >90%
- [ ] Integration tests passing
- [ ] Load testing validation
- [ ] Security testing complete
- [ ] End-to-end testing in AWS

### Launch Phase
- [ ] Documentation complete
- [ ] Demo preparation ready
- [ ] Performance monitoring active
- [ ] Error tracking configured
- [ ] Launch criteria met

---

## 💰 MVP Cost Estimation (AWS)

### Monthly AWS Costs (MVP)
- **EKS Cluster**: ~$75/month
- **EC2 Instances**: ~$50/month (t3.small)
- **RDS PostgreSQL**: ~$25/month (db.t3.micro)
- **ElastiCache Redis**: ~$20/month (cache.t3.micro)
- **Load Balancer**: ~$25/month
- **S3 + CloudFront**: ~$10/month
- **Monitoring**: ~$15/month

**Total MVP Cost**: ~$220/month (vs $500+/month for full production)

---

## 🎯 Post-MVP Roadmap (Future Phases)

### Phase 2: Enhanced Functionality (Month 2-3)
- Advanced targeting system
- Frequency capping
- Competitive separation
- Enhanced analytics

### Phase 3: Scale & Optimize (Month 4-6)
- Performance optimization
- Auto-scaling
- Advanced monitoring
- Multi-region support

### Phase 4: Enterprise Features (Month 6+)
- Real-time bidding
- Machine learning integration
- Advanced security
- White-label capabilities

---

**MVP Goal**: Demonstrate core CTV ad serving capabilities with production-ready infrastructure in 3-4 weeks, maintaining quality standards while minimizing scope.

*Created: September 29, 2024*
*Target MVP Launch: October 28, 2024*