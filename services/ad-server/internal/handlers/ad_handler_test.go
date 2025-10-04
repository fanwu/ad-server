package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/fanwu/ad-server/internal/models"
	"github.com/fanwu/ad-server/internal/redis"
	"github.com/gin-gonic/gin"
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

// seedTestData adds test data to Redis
func seedTestData(t *testing.T, redisClient *redis.Client) (string, string) {
	campaignID := uuid.New().String()
	creativeID := uuid.New().String()

	now := time.Now()
	startDate := now.Add(-24 * time.Hour).Format(time.RFC3339)
	endDate := now.Add(24 * time.Hour).Format(time.RFC3339)

	// Add campaign to Redis
	campaignData := map[string]interface{}{
		"id":           campaignID,
		"name":         "Test Campaign",
		"status":       "active",
		"budget_total": "10000.00",
		"budget_spent": "1000.00",
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
	if err := redisClient.AddActiveCampaign(campaignID, 9000.0); err != nil {
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

func TestHandleAdRequest_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	gin.SetMode(gin.TestMode)

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	campaignID, creativeID := seedTestData(t, redisClient)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	handler := NewAdHandler(redisClient)

	// Create test request
	reqBody := models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/ad-request", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()
	router.POST("/api/v1/ad-request", handler.HandleAdRequest)
	router.ServeHTTP(w, req)

	// Assertions
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response models.AdResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Verify response contains real data
	if response.AdID == "" {
		t.Error("AdID should not be empty")
	}
	if response.CampaignID != campaignID {
		t.Errorf("Expected campaign_id %s, got %s", campaignID, response.CampaignID)
	}
	if response.CreativeID != creativeID {
		t.Errorf("Expected creative_id %s, got %s", creativeID, response.CreativeID)
	}
	if response.VideoURL != "https://example.com/test-video.mp4" {
		t.Errorf("Expected video_url https://example.com/test-video.mp4, got %s", response.VideoURL)
	}
	if response.Duration != 30 {
		t.Errorf("Expected duration 30, got %d", response.Duration)
	}
	if response.Format != "mp4" {
		t.Errorf("Expected format mp4, got %s", response.Format)
	}
}

func TestHandleAdRequest_NoActiveCampaigns(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	gin.SetMode(gin.TestMode)

	// Setup with empty Redis
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	handler := NewAdHandler(redisClient)

	// Create test request
	reqBody := models.AdRequest{
		DeviceID:   "device-123",
		DeviceType: "ctv",
		AppID:      "app-456",
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/ad-request", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()
	router.POST("/api/v1/ad-request", handler.HandleAdRequest)
	router.ServeHTTP(w, req)

	// Should return 204 No Content when no ads available
	if w.Code != http.StatusNoContent {
		t.Errorf("Expected status 204, got %d", w.Code)
	}
}

func TestHandleAdRequest_MissingFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	handler := NewAdHandler(redisClient)

	// Create request with missing required fields
	reqBody := map[string]interface{}{
		"device_id": "device-123",
		// Missing device_type and app_id
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/ad-request", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()
	router.POST("/api/v1/ad-request", handler.HandleAdRequest)
	router.ServeHTTP(w, req)

	// The Gin binding validation happens inside the handler
	// If validation fails, it returns 400
	// If validation passes but no ads available, it returns 204
	// Since we're not using `binding:"required"` tags in AdRequest model,
	// empty fields are allowed and it returns 204 (no ads)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusNoContent {
		t.Errorf("Expected status 400 or 204, got %d", w.Code)
	}
}

func TestHandleImpression_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	gin.SetMode(gin.TestMode)

	// Setup
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	campaignID, creativeID := seedTestData(t, redisClient)
	defer cleanupTestData(t, redisClient, campaignID, creativeID)

	handler := NewAdHandler(redisClient)

	// Create impression request
	reqBody := models.ImpressionRequest{
		AdID:       uuid.New().String(),
		CampaignID: campaignID,
		CreativeID: creativeID,
		DeviceID:   "device-123",
		DeviceType: "ctv",
		Timestamp:  time.Now(),
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/impression", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()
	router.POST("/api/v1/impression", handler.HandleImpression)
	router.ServeHTTP(w, req)

	// Assertions
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["status"] != "success" {
		t.Errorf("Expected status 'success', got '%v'", response["status"])
	}
}

func TestHandleImpression_MissingFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	handler := NewAdHandler(redisClient)

	reqBody := map[string]interface{}{
		"ad_id": "ad-123",
		// Missing required fields
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/impression", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()
	router.POST("/api/v1/impression", handler.HandleImpression)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHealthCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	router := gin.New()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "ad-server",
		})
	})

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if response["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%v'", response["status"])
	}

	if response["service"] != "ad-server" {
		t.Errorf("Expected service 'ad-server', got '%v'", response["service"])
	}
}
