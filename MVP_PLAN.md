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

#### 5. **Simple Admin UI** ⭐ **NEW**
- Basic web interface for campaign management
- Creative upload form with drag-and-drop
- Campaign list and details view
- Simple analytics dashboard
- **Skip**: Advanced visualizations, user management, complex workflows

#### 6. **AWS Deployment** ⭐
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

| Service | Technology | Version | MVP Rationale |
|---------|------------|---------|---------------|
| **API Gateway** | **Node.js/Express** | 22.x / 4.x | Admin/management operations ✅ |
| **Ad Serving Engine** | **Go** | 1.21+ | **Real-time ad decisions, <10ms response** |
| **Campaign Management** | **Node.js/Express** | 22.x | Already implemented ✅ |
| **Admin UI** | **Next.js/TypeScript** | 15.5.4 | Already implemented ✅ |

**Decision: Go for Ad Serving from Day 1**
- Ad serving requires <10ms response times - Go is essential
- Use Gin or Fiber framework for high-performance HTTP
- Redis as primary data store for ad decisions (not PostgreSQL)
- PostgreSQL only for impression logging (async writes)

### Data Layer - **Redis-First Architecture for Real-Time Ad Serving**

| Component | Technology | Version | Role | Response Time |
|-----------|------------|---------|------|---------------|
| **Redis** | Redis | 7 | **PRIMARY data store for ad decisions** | Read: <1ms |
| **PostgreSQL** | PostgreSQL | 15 | Impression logging (async writes only) | Write: 5-10ms (async) |
| **S3** | AWS S3 | - | Creative video files | Presigned URLs |

#### Redis Data Model (Primary Ad Serving Store)

**Redis Sorted Sets & Hashes for Fast Lookups:**
```
# Active campaigns (sorted by priority/budget)
ZSET active_campaigns  → campaign_id:score (score = remaining_budget)

# Campaign metadata
HASH campaign:{id}     → {name, budget_total, budget_spent, start_date, end_date, status}

# Campaign's creatives
SET campaign:{id}:creatives  → {creative_id1, creative_id2, ...}

# Creative metadata
HASH creative:{id}     → {name, video_url, duration, format, status}

# Request counting (for budget pacing)
INCR campaign:{id}:requests:{hour}
INCR creative:{id}:impressions:{hour}
```

**Data Sync Strategy:**
- Node.js API Gateway writes to PostgreSQL (source of truth)
- **Background sync job** (Node.js) syncs PostgreSQL → Redis every 10 seconds
- On critical updates (campaign status change), immediate Redis update
- Redis data expires after 1 hour (TTL), forces resync

#### Go Ad Server Data Flow

```
[CTV Device]
    ↓
POST /ad-request
    ↓
[Go Ad Server]
    ↓
1. ZRANGE active_campaigns 0 -1  (Get all active campaigns)
2. Filter by date/budget in-memory (Go is fast)
3. SRANDMEMBER campaign:{id}:creatives  (Random creative)
4. HGETALL creative:{id}  (Get creative metadata)
5. Generate S3 presigned URL
6. Return response in <10ms
    ↓
[Kafka/Redis Stream] → Async impression logging
    ↓
[Node.js Worker] → Batch write to PostgreSQL
```

**Performance Targets:**
- Ad Request: <10ms p99 (Go + Redis)
- Redis Hit Rate: 100% (Redis is the primary store)
- Impression Logging: Async, batched every 5 seconds
- Throughput: 10,000+ req/sec per instance

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

---

## 🎨 Admin UI Specification (NEW)

### UI Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: React Context + SWR for data fetching
- **Forms**: React Hook Form + Zod validation
- **File Upload**: react-dropzone
- **Charts**: Recharts (simple, lightweight)
- **Authentication**: JWT stored in httpOnly cookies
- **Type Safety**: Full TypeScript coverage with strict type checking

### Page Structure

```
admin-ui/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Authenticated layout
│   │   ├── page.tsx                # Dashboard home
│   │   ├── campaigns/
│   │   │   ├── page.tsx           # Campaign list
│   │   │   ├── new/page.tsx       # Create campaign
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Campaign details
│   │   │       └── creatives/page.tsx  # Creative management
│   │   └── analytics/
│   │       └── page.tsx           # Analytics dashboard
│   ├── api/                       # API routes (proxy to backend)
│   └── layout.tsx                 # Root layout
├── components/
│   ├── ui/                        # shadcn/ui components (TypeScript)
│   ├── campaigns/                 # Campaign-specific components
│   ├── creatives/                 # Creative-specific components
│   └── charts/                    # Chart components
├── lib/
│   ├── api.ts                     # API client with full typing
│   ├── auth.ts                    # Auth utilities
│   └── types.ts                   # Shared TypeScript types
├── types/
│   ├── campaign.ts                # Campaign type definitions
│   ├── creative.ts                # Creative type definitions
│   └── analytics.ts               # Analytics type definitions
└── tsconfig.json                  # TypeScript configuration (strict mode)
```

### Key Pages & Features

#### 1. Login Page (`/login`)
- Simple email/password form
- JWT token stored in httpOnly cookie
- Redirect to dashboard on success
- Error handling with toast notifications

#### 2. Dashboard Home (`/`)
- Key metrics cards (total campaigns, active campaigns, total impressions)
- Recent campaigns table
- Quick actions (Create Campaign, Upload Creative)
- Simple line chart showing impressions over last 7 days

#### 3. Campaign List (`/campaigns`)
- Searchable/filterable table
- Columns: Name, Status, Budget, Start/End Date, Impressions, Actions
- Status badges (draft/active/paused/completed)
- Quick actions: Edit, Pause/Resume, View Creatives
- Create Campaign button

#### 4. Create/Edit Campaign (`/campaigns/new`, `/campaigns/[id]`)
- Form fields:
  - Campaign Name
  - Description
  - Budget Total
  - Start Date / End Date (date pickers)
  - Status (dropdown)
- Client-side validation with error messages
- Save and Cancel buttons
- Redirect to campaign list on success

#### 5. Campaign Details (`/campaigns/[id]`)
- Campaign information display
- Status management (activate, pause, complete)
- Budget spent progress bar
- Associated creatives list
- Add Creative button
- Basic performance metrics

#### 6. Creative Management (`/campaigns/[id]/creatives`)
- Drag-and-drop file upload zone
- File validation (MP4 only, max 100MB, max 120s)
- Upload progress indicator
- Creative list with thumbnails (video preview)
- Creative details: name, duration, file size, status
- Delete creative action

#### 7. Analytics Dashboard (`/analytics`)
- Campaign performance table
- Metrics: Impressions, CPM, Budget Spent, Budget Remaining
- Date range selector
- Simple charts:
  - Impressions over time (line chart)
  - Campaign comparison (bar chart)
- Export to CSV button

### UI/UX Guidelines

**Design Principles:**
- Clean, minimal interface
- Focus on usability over aesthetics
- Fast page loads (<2s)
- Mobile-responsive (works on tablet)

**Color Scheme:**
- Primary: Blue (#3b82f6)
- Success: Green (#10b981)
- Warning: Yellow (#f59e0b)
- Error: Red (#ef4444)
- Neutral: Gray scale

**Components to Use (shadcn/ui):**
- Button, Input, Label, Select
- Table, Card, Badge
- Dialog (for confirmations)
- Toast (for notifications)
- Form components
- Progress bar
- Date picker

### API Integration

**Type Definitions (`types/campaign.ts`):**
```typescript
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  budget_total: number;
  budget_spent: number;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignDto {
  name: string;
  description?: string;
  budget_total: number;
  start_date: string;
  end_date: string;
}

export interface UpdateCampaignStatusDto {
  status: CampaignStatus;
}
```

**Type Definitions (`types/creative.ts`):**
```typescript
export type CreativeStatus = 'active' | 'inactive' | 'processing' | 'failed';

export interface Creative {
  id: string;
  campaign_id: string;
  name: string;
  video_url: string;
  duration: number;
  file_size: number | null;
  width: number | null;
  height: number | null;
  format: string;
  status: CreativeStatus;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface UploadCreativeDto {
  name: string;
  video: File;
}
```

**API Client (`lib/api.ts`):**
```typescript
import type { Campaign, CreateCampaignDto, UpdateCampaignStatusDto } from '@/types/campaign';
import type { Creative, UploadCreativeDto } from '@/types/creative';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Campaigns
export const getCampaigns = async (): Promise<ApiResponse<Campaign[]>> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/campaigns`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch campaigns');
  const data = await response.json();
  return { data: data.campaigns };
};

export const getCampaign = async (id: string): Promise<ApiResponse<Campaign>> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch campaign');
  const data = await response.json();
  return { data: data.campaign };
};

export const createCampaign = async (data: CreateCampaignDto): Promise<ApiResponse<Campaign>> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create campaign');
  const result = await response.json();
  return { data: result.campaign };
};

export const updateCampaignStatus = async (
  id: string,
  status: UpdateCampaignStatusDto
): Promise<ApiResponse<Campaign>> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(status),
  });
  if (!response.ok) throw new Error('Failed to update campaign status');
  const result = await response.json();
  return { data: result.campaign };
};

// Creatives
export const uploadCreative = async (
  campaignId: string,
  data: UploadCreativeDto
): Promise<ApiResponse<Creative>> => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('video', data.video);

  const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/creatives`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload creative');
  const result = await response.json();
  return { data: result.creative };
};
```

**TypeScript Configuration (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Authentication Flow
1. User logs in via `/login`
2. JWT token stored in httpOnly cookie (handled by Next.js API route)
3. All API requests include token automatically
4. Middleware checks auth on protected routes
5. Redirect to login if token expired

### Deployment
- Built as static + API routes (hybrid)
- Deployed to AWS S3 + CloudFront
- Environment variables for API URL
- CI/CD via GitHub Actions

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

### Week 1: Database & Basic API (Oct 1-7) ✅ COMPLETED
**Days 1-2: Database Schema** ✅
- Created simplified migration files
- Implemented campaigns and creatives tables
- Tested basic CRUD operations

**Days 3-5: Campaign Management** ✅
- Implemented simplified campaign endpoints
- Added validation and error handling
- Created unit tests for campaign operations

**Days 6-7: Creative Management** ✅
- Implemented file upload for MP4 videos
- Added basic file validation with S3 integration
- Linked creatives to campaigns

### Week 2: Admin UI Foundation (Oct 8-14) 🎨 **PRIORITY CHANGE**
**Goal:** Get something visual working quickly to see existing backend functionality

**Days 1-2: Project Setup & Authentication**
- Setup Next.js 14 project with TypeScript (strict mode)
- Install and configure Tailwind CSS + shadcn/ui
- Create TypeScript type definitions (Campaign, Creative)
- Build API client with full typing (`lib/api.ts`)
- Implement login page with form validation
- Set up JWT cookie-based authentication
- Create basic layout with navigation

**Days 3-4: Campaign List & Dashboard**
- Build dashboard home page (simple welcome + metrics cards placeholders)
- Create campaign list page
  - Fetch campaigns from existing API
  - Display in table with columns: Name, Status, Budget, Dates
  - Add status badges (draft/active/paused/completed)
  - Add search/filter functionality
  - Loading and error states
- Test with existing backend data

**Days 5-7: Campaign Details & Polish**
- Build campaign details page
  - Display all campaign information
  - Show associated creatives list
  - Budget progress bar
- Add navigation between pages
- Responsive design (mobile/tablet)
- Basic error handling and notifications (toast)
- Polish styling and UX

**Deliverable:** A functional UI where you can login, see campaigns, view details - **something visual to demo!**

### Week 3: Complete UI Features + Ad Serving Backend (Oct 15-21)
**Days 1-3: Campaign & Creative Management UI**
- Campaign creation form
  - Form with validation (React Hook Form + Zod)
  - Date picker for start/end dates
  - Budget input with validation
  - Status dropdown
  - Error handling and success feedback
- Campaign edit and status update functionality
- Creative upload interface
  - Drag-and-drop zone (react-dropzone)
  - File validation (MP4, size, duration)
  - Upload progress indicator
  - Preview uploaded creatives
  - Creative list per campaign

**Days 4-5: Ad Serving Backend**
- Implement basic ad request endpoint (`POST /api/v1/ad-request`)
  - Filter active campaigns (status = 'active')
  - Check campaign dates (current date within start/end)
  - Select random creative from eligible campaigns
  - Return creative URL and metadata
- Implement impression tracking endpoint (`POST /api/v1/impression`)
  - Store impression record in database
  - Update campaign impression count
  - Link to ad request
- Add basic tests for ad serving logic

**Days 6-7: Analytics Backend + Dashboard UI**
- Analytics backend endpoints
  - `GET /api/v1/campaigns/:id/stats` - Campaign metrics
  - `GET /api/v1/analytics/dashboard` - Overall metrics
  - Calculate: total impressions, active campaigns, budget spent
- Analytics dashboard UI
  - Key metrics cards (total campaigns, impressions, budget)
  - Campaign performance table
  - Simple line chart (impressions over time) with Recharts
  - Date range selector

**Deliverable:** Complete UI for managing campaigns/creatives + functional ad serving + basic analytics

### Week 4: AWS Infrastructure & Launch (Oct 22-28)
**Days 1-3: Infrastructure Setup**
- Terraform configuration for MVP (API + UI)
- Deploy to AWS with CloudFront for UI
- Basic monitoring and logging

**Days 4-5: Testing & Polish**
- End-to-end testing (UI + API)
- Bug fixes and optimization
- Documentation updates

**Days 6-7: Final Testing & Launch**
- Load testing validation
- Security review
- MVP launch preparation

---

## ✅ MVP Success Criteria

### Technical Requirements
- **Response Time**: Ad requests <100ms, UI pages <2s
- **Uptime**: 99%+ availability
- **Throughput**: 500+ ad requests per minute
- **Test Coverage**: >90% for MVP features

### Functional Requirements
- ✅ Create and manage campaigns via UI
- ✅ Upload and manage video creatives via UI
- ✅ Serve ads via API
- ✅ Track basic impressions
- ✅ View campaign performance in dashboard
- ✅ User authentication and session management
- ✅ Deploy and run in AWS (API + UI)

### Demo Capabilities
1. **User Login**: Login to admin dashboard
2. **Campaign Creation**: Create a campaign via UI in <2 minutes
3. **Creative Upload**: Upload video creative via drag-and-drop
4. **Ad Serving**: Request and receive ads via API (programmatic)
5. **Analytics**: View campaign performance in dashboard
6. **Scale**: Handle multiple concurrent users and ad requests

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
- [x] Review and approve MVP scope ✅
- [x] Set up MVP branch in git ✅
- [x] Configure MVP environment variables ✅
- [x] Plan MVP test data and scenarios ✅

### Development Phase - Backend (Weeks 1-2)
- [x] Implement simplified database schema ✅
- [x] Build MVP API endpoints (campaigns, creatives) ✅
- [x] Create comprehensive test suite (194+ tests) ✅
- [ ] Implement ad serving endpoints (Week 3)
- [ ] Add basic analytics endpoints (Week 3)

### Development Phase - Frontend **NEW PRIORITY** (Weeks 2-3)
**Week 2: Foundation (Something Visual)**
- [ ] Set up Next.js 14 admin UI project with TypeScript
- [ ] Configure TypeScript strict mode and type definitions
- [ ] Implement login page with authentication flow
- [ ] Build dashboard home page (basic welcome screen)
- [ ] Build campaign list page (read from API)
- [ ] Build campaign details page (read from API)
- [ ] Add basic navigation and layout

**Week 3: Complete Features**
- [ ] Build campaign creation form with validation
- [ ] Build campaign edit functionality
- [ ] Create creative upload interface with drag-and-drop
- [ ] Build analytics dashboard with charts
- [ ] Add responsive design for mobile/tablet
- [ ] Polish UI/UX and error handling
- [ ] Set up TypeScript linting and type checking in CI

### Infrastructure & Deployment
- [ ] Set up AWS infrastructure for UI (CloudFront, S3)
- [ ] Update Terraform configuration
- [ ] Implement deployment automation
- [ ] Configure CDN for UI assets

### Testing Phase
- [x] Backend unit test coverage >90% ✅
- [x] Backend integration tests passing ✅
- [ ] UI component tests
- [ ] End-to-end UI tests (Cypress/Playwright)
- [ ] Load testing validation
- [ ] Security testing complete
- [ ] Cross-browser testing

### Launch Phase
- [ ] API documentation complete
- [ ] UI user guide complete
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
- **S3 + CloudFront (Creatives)**: ~$10/month
- **S3 + CloudFront (UI Hosting)**: ~$5/month **NEW**
- **Monitoring**: ~$15/month

**Total MVP Cost**: ~$225/month (vs $500+/month for full production)

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