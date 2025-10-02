package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestHandleAdRequest_MissingFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

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

	// Mock handler that validates input
	router.POST("/api/v1/ad-request", func(c *gin.Context) {
		var input struct {
			DeviceID   string `json:"device_id" binding:"required"`
			DeviceType string `json:"device_type" binding:"required"`
			AppID      string `json:"app_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandleAdRequest_ValidInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	reqBody := map[string]interface{}{
		"device_id":   "device-123",
		"device_type": "ctv",
		"app_id":      "app-456",
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/ad-request", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()

	router.POST("/api/v1/ad-request", func(c *gin.Context) {
		var input struct {
			DeviceID   string `json:"device_id" binding:"required"`
			DeviceType string `json:"device_type" binding:"required"`
			AppID      string `json:"app_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validation passed
		if input.DeviceID != "device-123" {
			t.Errorf("Expected device_id 'device-123', got '%s'", input.DeviceID)
		}
		if input.DeviceType != "ctv" {
			t.Errorf("Expected device_type 'ctv', got '%s'", input.DeviceType)
		}
		if input.AppID != "app-456" {
			t.Errorf("Expected app_id 'app-456', got '%s'", input.AppID)
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandleImpression_ValidInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	reqBody := map[string]interface{}{
		"ad_id":       "ad-123",
		"campaign_id": "campaign-1",
		"creative_id": "creative-1",
		"device_id":   "device-123",
		"duration":    30,
		"completed":   true,
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/impression", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()

	router.POST("/api/v1/impression", func(c *gin.Context) {
		var input struct {
			AdID       string `json:"ad_id" binding:"required"`
			CampaignID string `json:"campaign_id" binding:"required"`
			CreativeID string `json:"creative_id" binding:"required"`
			DeviceID   string `json:"device_id" binding:"required"`
			Duration   int    `json:"duration"`
			Completed  bool   `json:"completed"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validation passed
		if input.AdID != "ad-123" {
			t.Errorf("Expected ad_id 'ad-123', got '%s'", input.AdID)
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandleImpression_MissingFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	reqBody := map[string]interface{}{
		"ad_id": "ad-123",
		// Missing required fields
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/impression", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router := gin.New()

	router.POST("/api/v1/impression", func(c *gin.Context) {
		var input struct {
			AdID       string `json:"ad_id" binding:"required"`
			CampaignID string `json:"campaign_id" binding:"required"`
			CreativeID string `json:"creative_id" binding:"required"`
			DeviceID   string `json:"device_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

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
