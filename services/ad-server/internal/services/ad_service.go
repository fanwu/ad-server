package services

import (
	"fmt"
	"strconv"
	"time"

	"github.com/fanwu/ad-server/internal/models"
	"github.com/fanwu/ad-server/internal/redis"
	"github.com/google/uuid"
)

type AdService struct {
	redis *redis.Client
}

func NewAdService(redisClient *redis.Client) *AdService {
	return &AdService{
		redis: redisClient,
	}
}

// SelectAd selects an appropriate ad for the request
func (s *AdService) SelectAd(req *models.AdRequest) (*models.AdResponse, error) {
	// Get all active campaigns from Redis
	campaignIDs, err := s.redis.GetActiveCampaigns()
	if err != nil {
		return nil, fmt.Errorf("failed to get active campaigns: %w", err)
	}

	if len(campaignIDs) == 0 {
		return nil, fmt.Errorf("no active campaigns available")
	}

	now := time.Now()

	// Filter campaigns by date and budget
	var eligibleCampaigns []string
	for _, campaignID := range campaignIDs {
		campaign, err := s.redis.GetCampaign(campaignID)
		if err != nil {
			continue // Skip this campaign if we can't fetch it
		}

		// Check status
		if campaign["status"] != "active" {
			continue
		}

		// Check date range
		startDate, err := time.Parse(time.RFC3339, campaign["start_date"])
		if err != nil || now.Before(startDate) {
			continue
		}

		endDate, err := time.Parse(time.RFC3339, campaign["end_date"])
		if err != nil || now.After(endDate) {
			continue
		}

		// Check budget
		budgetTotal, _ := strconv.ParseFloat(campaign["budget_total"], 64)
		budgetSpent, _ := strconv.ParseFloat(campaign["budget_spent"], 64)
		if budgetSpent >= budgetTotal {
			continue
		}

		eligibleCampaigns = append(eligibleCampaigns, campaignID)
	}

	if len(eligibleCampaigns) == 0 {
		return nil, fmt.Errorf("no eligible campaigns found")
	}

	// For MVP: simple random selection from eligible campaigns
	// In production, this would use sophisticated targeting and pacing algorithms
	selectedCampaignID := eligibleCampaigns[0]
	if len(eligibleCampaigns) > 1 {
		// Simple round-robin or weighted selection could go here
		selectedCampaignID = eligibleCampaigns[time.Now().UnixNano()%int64(len(eligibleCampaigns))]
	}

	// Get a random creative from the selected campaign
	creativeID, err := s.redis.GetRandomCreative(selectedCampaignID)
	if err != nil {
		return nil, fmt.Errorf("failed to get creative: %w", err)
	}

	creative, err := s.redis.GetCreative(creativeID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch creative details: %w", err)
	}

	// Check creative status
	if creative["status"] != "active" {
		return nil, fmt.Errorf("creative is not active")
	}

	// Parse duration
	duration, _ := strconv.Atoi(creative["duration"])

	// Increment request counter (async, don't wait for result)
	go s.redis.IncrementCampaignRequests(selectedCampaignID)

	// Generate ad ID for tracking
	adID := uuid.New().String()

	// Build response
	response := &models.AdResponse{
		AdID:        adID,
		CampaignID:  selectedCampaignID,
		CreativeID:  creativeID,
		VideoURL:    creative["video_url"],
		Duration:    duration,
		Format:      creative["format"],
		TrackingURL: fmt.Sprintf("/api/v1/impression"), // Client will POST here
		Timestamp:   now,
	}

	return response, nil
}

// TrackImpression records an impression
func (s *AdService) TrackImpression(req *models.ImpressionRequest) error {
	// Increment creative impression counter (async)
	go s.redis.IncrementCreativeImpressions(req.CreativeID)

	// In a real system, we would:
	// 1. Write to PostgreSQL asynchronously (batch writes)
	// 2. Update budget spent
	// 3. Update campaign/creative metrics
	// For MVP, just the counter increment is sufficient

	return nil
}
