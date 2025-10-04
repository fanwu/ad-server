package services

import (
	"os"
	"testing"
	"time"

	"github.com/fanwu/ad-server/internal/models"
	"github.com/fanwu/ad-server/internal/redis"
	"github.com/google/uuid"
)

// setupTestRedis creates a real Redis connection for testing
func setupTestRedis(t *testing.T) *redis.Client {
	redisURL := os.Getenv("REDIS_TEST_URL")
	if redisURL == "" {
		redisURL = "localhost:6380" // Test Redis on port 6380
	}

	client, err := redis.NewClient(redisURL)
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	return client
}

// seedTestCampaign adds a test campaign and creative to Redis
func seedTestCampaign(t *testing.T, redisClient *redis.Client, startOffset, endOffset time.Duration, budgetTotal, budgetSpent float64) (string, string) {
	campaignID := uuid.New().String()
	creativeID := uuid.New().String()

	now := time.Now()
	startDate := now.Add(startOffset).Format(time.RFC3339)
	endDate := now.Add(endOffset).Format(time.RFC3339)

	// Add campaign to Redis
	campaignData := map[string]interface{}{
		"id":           campaignID,
		"name":         "Test Campaign",
		"status":       "active",
		"budget_total": budgetTotal,
		"budget_spent": budgetSpent,
		"start_date":   startDate,
		"end_date":     endDate,
	}

	if err := redisClient.SetCampaign(campaignID, campaignData); err != nil {
		t.Fatalf("Failed to set campaign: %v", err)
	}

	// Add creative to Redis
	creativeData := map[string]interface{}{
		"id":          creativeID,
		"campaign_id": campaignID,
		"name":        "Test Creative",
		"video_url":   "https://example.com/test-video.mp4",
		"duration":    "30",
		"format":      "mp4",
		"status":      "active",
	}

	if err := redisClient.SetCreative(creativeID, campaignID, creativeData); err != nil {
		t.Fatalf("Failed to set creative: %v", err)
	}

	// Add to active campaigns sorted set
	remainingBudget := budgetTotal - budgetSpent
	if err := redisClient.AddActiveCampaign(campaignID, remainingBudget); err != nil {
		t.Fatalf("Failed to add active campaign: %v", err)
	}

	return campaignID, creativeID
}

// cleanupTestData removes test data from Redis
func cleanupTestData(t *testing.T, redisClient *redis.Client, campaignID, creativeID string) {
	redisClient.DeleteCampaign(campaignID)
	redisClient.DeleteCreative(creativeID, campaignID)
	redisClient.RemoveActiveCampaign(campaignID)
}

func TestSelectAd_Success(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	// Create campaign: started yesterday, ends tomorrow, has budget
	campaignID, creativeID := seedTestCampaign(t, redisClient,
		-24*time.Hour,  // started yesterday
		24*time.Hour,   // ends tomorrow
		10000.0,        // total budget
		1000.0,         // spent budget
	)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	service := NewAdService(redisClient)

	// Create ad request
	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	// Select ad
	adResp, err := service.SelectAd(req)

	// Assertions
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if adResp == nil {
		t.Fatal("Expected ad response, got nil")
	}

	if adResp.CampaignID != campaignID {
		t.Errorf("Expected campaign_id %s, got %s", campaignID, adResp.CampaignID)
	}

	if adResp.CreativeID != creativeID {
		t.Errorf("Expected creative_id %s, got %s", creativeID, adResp.CreativeID)
	}

	if adResp.VideoURL != "https://example.com/test-video.mp4" {
		t.Errorf("Expected video_url https://example.com/test-video.mp4, got %s", adResp.VideoURL)
	}

	if adResp.Duration != 30 {
		t.Errorf("Expected duration 30, got %d", adResp.Duration)
	}

	if adResp.Format != "mp4" {
		t.Errorf("Expected format mp4, got %s", adResp.Format)
	}

	if adResp.AdID == "" {
		t.Error("AdID should not be empty")
	}
}

func TestSelectAd_ExpiredCampaign(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	// Create campaign that ended yesterday
	campaignID, creativeID := seedTestCampaign(t, redisClient,
		-48*time.Hour, // started 2 days ago
		-24*time.Hour, // ended yesterday
		10000.0,
		1000.0,
	)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	service := NewAdService(redisClient)

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	// Select ad
	adResp, err := service.SelectAd(req)

	// Should return error because campaign is expired
	if err == nil {
		t.Error("Expected error for expired campaign, got nil")
	}

	if adResp != nil {
		t.Error("Expected nil response for expired campaign, got response")
	}
}

func TestSelectAd_FutureCampaign(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	// Create campaign that starts tomorrow
	campaignID, creativeID := seedTestCampaign(t, redisClient,
		24*time.Hour, // starts tomorrow
		48*time.Hour, // ends in 2 days
		10000.0,
		1000.0,
	)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	service := NewAdService(redisClient)

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	// Select ad
	adResp, err := service.SelectAd(req)

	// Should return error because campaign hasn't started
	if err == nil {
		t.Error("Expected error for future campaign, got nil")
	}

	if adResp != nil {
		t.Error("Expected nil response for future campaign, got response")
	}
}

func TestSelectAd_BudgetExceeded(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	// Create campaign with budget exceeded (spent >= total)
	campaignID, creativeID := seedTestCampaign(t, redisClient,
		-24*time.Hour,
		24*time.Hour,
		10000.0, // total budget
		10000.0, // spent budget (equal to total)
	)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	service := NewAdService(redisClient)

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	// Select ad
	adResp, err := service.SelectAd(req)

	// Should return error because budget is exhausted
	if err == nil {
		t.Error("Expected error for exhausted budget, got nil")
	}

	if adResp != nil {
		t.Error("Expected nil response for exhausted budget, got response")
	}
}

func TestSelectAd_InactiveCampaign(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	campaignID := uuid.New().String()
	creativeID := uuid.New().String()

	now := time.Now()
	startDate := now.Add(-24 * time.Hour).Format(time.RFC3339)
	endDate := now.Add(24 * time.Hour).Format(time.RFC3339)

	// Add inactive campaign to Redis
	campaignData := map[string]interface{}{
		"id":           campaignID,
		"name":         "Inactive Test Campaign",
		"status":       "paused", // INACTIVE
		"budget_total": "10000.00",
		"budget_spent": "1000.00",
		"start_date":   startDate,
		"end_date":     endDate,
	}

	if err := redisClient.SetCampaign(campaignID, campaignData); err != nil {
		t.Fatalf("Failed to set campaign: %v", err)
	}

	// Add creative
	creativeData := map[string]interface{}{
		"id":          creativeID,
		"campaign_id": campaignID,
		"name":        "Test Creative",
		"video_url":   "https://example.com/test-video.mp4",
		"duration":    "30",
		"format":      "mp4",
		"status":      "active",
	}

	if err := redisClient.SetCreative(creativeID, campaignID, creativeData); err != nil {
		t.Fatalf("Failed to set creative: %v", err)
	}

	// Add to active campaigns sorted set
	if err := redisClient.AddActiveCampaign(campaignID, 9000.0); err != nil {
		t.Fatalf("Failed to add active campaign: %v", err)
	}

	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	service := NewAdService(redisClient)

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	// Select ad
	adResp, err := service.SelectAd(req)

	// Should return error because campaign status is not active
	if err == nil {
		t.Error("Expected error for inactive campaign, got nil")
	}

	if adResp != nil {
		t.Error("Expected nil response for inactive campaign, got response")
	}
}

func TestSelectAd_NoActiveCampaigns(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup with empty Redis
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	service := NewAdService(redisClient)

	req := &models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	// Select ad
	adResp, err := service.SelectAd(req)

	// Should return error because no campaigns exist
	if err == nil {
		t.Error("Expected error for no campaigns, got nil")
	}

	if adResp != nil {
		t.Error("Expected nil response for no campaigns, got response")
	}
}

func TestTrackImpression_Success(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	campaignID, creativeID := seedTestCampaign(t, redisClient,
		-24*time.Hour,
		24*time.Hour,
		10000.0,
		1000.0,
	)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	service := NewAdService(redisClient)

	// Create impression request
	req := &models.ImpressionRequest{
		AdID:       uuid.New().String(),
		CampaignID: campaignID,
		CreativeID: creativeID,
		DeviceID:   "device-123",
		DeviceType: "ctv",
		Timestamp:  time.Now(),
	}

	// Track impression
	err := service.TrackImpression(req)

	// Should succeed
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	// Note: Redis counter increment happens in a goroutine,
	// so we can't reliably test the counter value immediately
	// The integration test just ensures the API doesn't error
}
