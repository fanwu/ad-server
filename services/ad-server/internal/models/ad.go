package models

import "time"

// AdRequest represents an incoming ad request
type AdRequest struct {
	DeviceID   string            `json:"device_id" binding:"required"`
	DeviceType string            `json:"device_type"` // ctv, mobile, web
	AppID      string            `json:"app_id"`
	UserAgent  string            `json:"user_agent"`
	IPAddress  string            `json:"ip_address"`
	Context    map[string]string `json:"context"` // Additional context
}

// AdResponse represents the ad decision response
type AdResponse struct {
	AdID        string    `json:"ad_id"`
	CampaignID  string    `json:"campaign_id"`
	CreativeID  string    `json:"creative_id"`
	VideoURL    string    `json:"video_url"`
	Duration    int       `json:"duration"`    // seconds
	Format      string    `json:"format"`      // mp4, webm, etc
	ClickURL    string    `json:"click_url"`   // Optional
	TrackingURL string    `json:"tracking_url"` // For impression tracking
	Timestamp   time.Time `json:"timestamp"`
}

// ImpressionRequest represents an impression tracking request
type ImpressionRequest struct {
	AdID       string    `json:"ad_id" binding:"required"`
	CampaignID string    `json:"campaign_id" binding:"required"`
	CreativeID string    `json:"creative_id" binding:"required"`
	DeviceID   string    `json:"device_id" binding:"required"`
	Timestamp  time.Time `json:"timestamp"`
	Duration   int       `json:"duration"` // How long the ad was watched (seconds)
	Completed  bool      `json:"completed"` // Did the user watch the full ad?
}

// Campaign represents campaign data in Redis
type Campaign struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	BudgetTotal float64   `json:"budget_total"`
	BudgetSpent float64   `json:"budget_spent"`
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
}

// Creative represents creative data in Redis
type Creative struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	VideoURL string `json:"video_url"`
	Duration int    `json:"duration"`
	Format   string `json:"format"`
	Status   string `json:"status"`
}
