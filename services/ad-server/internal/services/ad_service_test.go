package services

import (
	"testing"
	"time"

	"github.com/fanwu/ad-server/internal/models"
	"github.com/fanwu/ad-server/internal/redis"
)

// MockRedisClient for testing
type MockRedisClient struct {
	campaigns map[string]map[string]string
	creatives map[string]map[string]string
	sets      map[string][]string
}

func NewMockRedisClient() *MockRedisClient {
	return &MockRedisClient{
		campaigns: make(map[string]map[string]string),
		creatives: make(map[string]map[string]string),
		sets:      make(map[string][]string),
	}
}

func (m *MockRedisClient) GetActiveCampaigns() ([]string, error) {
	return []string{"campaign-1", "campaign-2"}, nil
}

func (m *MockRedisClient) GetCampaign(id string) (map[string]string, error) {
	if campaign, ok := m.campaigns[id]; ok {
		return campaign, nil
	}
	return make(map[string]string), nil
}

func (m *MockRedisClient) GetRandomCreative(campaignID string) (string, error) {
	key := "campaign:" + campaignID + ":creatives"
	if creatives, ok := m.sets[key]; ok && len(creatives) > 0 {
		return creatives[0], nil
	}
	return "", redis.ErrNil
}

func (m *MockRedisClient) GetCreative(id string) (map[string]string, error) {
	if creative, ok := m.creatives[id]; ok {
		return creative, nil
	}
	return make(map[string]string), nil
}

func (m *MockRedisClient) IncrementCounter(key string) error {
	return nil
}

func (m *MockRedisClient) Close() error {
	return nil
}

func TestSelectAd_Success(t *testing.T) {
	mockRedis := NewMockRedisClient()

	// Set up mock data
	now := time.Now()
	mockRedis.campaigns["campaign-1"] = map[string]string{
		"id":            "campaign-1",
		"name":          "Test Campaign",
		"status":        "active",
		"budget_total":  "1000.00",
		"budget_spent":  "500.00",
		"start_date":    now.Add(-24 * time.Hour).Format(time.RFC3339),
		"end_date":      now.Add(24 * time.Hour).Format(time.RFC3339),
	}

	mockRedis.sets["campaign:campaign-1:creatives"] = []string{"creative-1"}
	mockRedis.creatives["creative-1"] = map[string]string{
		"id":          "creative-1",
		"campaign_id": "campaign-1",
		"name":        "Test Creative",
		"video_url":   "https://example.com/video.mp4",
		"duration":    "30",
		"format":      "mp4",
		"status":      "active",
	}

	service := &AdService{redis: mockRedis}

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	ad, err := service.SelectAd(req)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if ad == nil {
		t.Fatal("Expected ad response, got nil")
	}

	if ad.CampaignID != "campaign-1" {
		t.Errorf("Expected campaign_id 'campaign-1', got '%s'", ad.CampaignID)
	}

	if ad.CreativeID != "creative-1" {
		t.Errorf("Expected creative_id 'creative-1', got '%s'", ad.CreativeID)
	}

	if ad.VideoURL != "https://example.com/video.mp4" {
		t.Errorf("Expected video_url 'https://example.com/video.mp4', got '%s'", ad.VideoURL)
	}

	if ad.Duration != 30 {
		t.Errorf("Expected duration 30, got %d", ad.Duration)
	}
}

func TestSelectAd_ExpiredCampaign(t *testing.T) {
	mockRedis := NewMockRedisClient()

	// Set up expired campaign
	now := time.Now()
	mockRedis.campaigns["campaign-1"] = map[string]string{
		"id":            "campaign-1",
		"name":          "Expired Campaign",
		"status":        "active",
		"budget_total":  "1000.00",
		"budget_spent":  "500.00",
		"start_date":    now.Add(-48 * time.Hour).Format(time.RFC3339),
		"end_date":      now.Add(-24 * time.Hour).Format(time.RFC3339), // Expired
	}

	service := &AdService{redis: mockRedis}

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	_, err := service.SelectAd(req)

	if err == nil {
		t.Fatal("Expected error for expired campaign, got nil")
	}

	if err.Error() != "no eligible campaigns found" {
		t.Errorf("Expected 'no eligible campaigns found', got '%s'", err.Error())
	}
}

func TestSelectAd_BudgetExceeded(t *testing.T) {
	mockRedis := NewMockRedisClient()

	// Set up campaign with budget exceeded
	now := time.Now()
	mockRedis.campaigns["campaign-1"] = map[string]string{
		"id":            "campaign-1",
		"name":          "Budget Exceeded Campaign",
		"status":        "active",
		"budget_total":  "1000.00",
		"budget_spent":  "1000.00", // Budget fully spent
		"start_date":    now.Add(-24 * time.Hour).Format(time.RFC3339),
		"end_date":      now.Add(24 * time.Hour).Format(time.RFC3339),
	}

	service := &AdService{redis: mockRedis}

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	_, err := service.SelectAd(req)

	if err == nil {
		t.Fatal("Expected error for budget exceeded, got nil")
	}

	if err.Error() != "no eligible campaigns found" {
		t.Errorf("Expected 'no eligible campaigns found', got '%s'", err.Error())
	}
}

func TestSelectAd_InactiveCampaign(t *testing.T) {
	mockRedis := NewMockRedisClient()

	// Set up inactive campaign
	now := time.Now()
	mockRedis.campaigns["campaign-1"] = map[string]string{
		"id":            "campaign-1",
		"name":          "Inactive Campaign",
		"status":        "paused", // Not active
		"budget_total":  "1000.00",
		"budget_spent":  "500.00",
		"start_date":    now.Add(-24 * time.Hour).Format(time.RFC3339),
		"end_date":      now.Add(24 * time.Hour).Format(time.RFC3339),
	}

	service := &AdService{redis: mockRedis}

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	_, err := service.SelectAd(req)

	if err == nil {
		t.Fatal("Expected error for inactive campaign, got nil")
	}

	if err.Error() != "no eligible campaigns found" {
		t.Errorf("Expected 'no eligible campaigns found', got '%s'", err.Error())
	}
}

func TestTrackImpression_Success(t *testing.T) {
	mockRedis := NewMockRedisClient()
	service := &AdService{redis: mockRedis}

	req := &models.ImpressionRequest{
		AdID:       "ad-123",
		CampaignID: "campaign-1",
		CreativeID: "creative-1",
		DeviceID:   "device-123",
		Duration:   30,
		Completed:  true,
	}

	err := service.TrackImpression(req)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}
