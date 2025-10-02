package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/fanwu/ad-server/internal/models"
	"github.com/fanwu/ad-server/internal/redis"
	"github.com/fanwu/ad-server/internal/services"
	"github.com/gin-gonic/gin"
)

type AdHandler struct {
	adService *services.AdService
}

func NewAdHandler(redisClient *redis.Client) *AdHandler {
	return &AdHandler{
		adService: services.NewAdService(redisClient),
	}
}

// HandleAdRequest handles POST /api/v1/ad-request
func (h *AdHandler) HandleAdRequest(c *gin.Context) {
	start := time.Now()

	var req models.AdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
			"details": err.Error(),
		})
		return
	}

	// Add IP address from request
	req.IPAddress = c.ClientIP()

	// Select ad
	adResponse, err := h.adService.SelectAd(&req)
	if err != nil {
		log.Printf("Failed to select ad: %v", err)
		c.JSON(http.StatusNoContent, gin.H{
			"error": "No ads available",
		})
		return
	}

	// Log response time
	elapsed := time.Since(start)
	log.Printf("Ad request served in %v - Campaign: %s, Creative: %s",
		elapsed, adResponse.CampaignID, adResponse.CreativeID)

	c.JSON(http.StatusOK, adResponse)
}

// HandleImpression handles POST /api/v1/impression
func (h *AdHandler) HandleImpression(c *gin.Context) {
	var req models.ImpressionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
			"details": err.Error(),
		})
		return
	}

	// Set timestamp if not provided
	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	// Track impression
	if err := h.adService.TrackImpression(&req); err != nil {
		log.Printf("Failed to track impression: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to track impression",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"message": "Impression tracked",
	})
}
