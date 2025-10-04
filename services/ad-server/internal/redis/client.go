package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb *redis.Client
	ctx context.Context
}

func NewClient(addrAndPassword ...string) (*Client, error) {
	addr := "localhost:6379"
	password := ""

	if len(addrAndPassword) > 0 {
		addr = addrAndPassword[0]
	}
	if len(addrAndPassword) > 1 {
		password = addrAndPassword[1]
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           0,
		PoolSize:     100,
		MinIdleConns: 10,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx := context.Background()

	// Test connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping Redis: %w", err)
	}

	return &Client{
		rdb: rdb,
		ctx: ctx,
	}, nil
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

func (c *Client) GetActiveCampaigns() ([]string, error) {
	// Get all active campaigns from sorted set
	// Sorted by remaining budget (score)
	result, err := c.rdb.ZRange(c.ctx, "active_campaigns", 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get active campaigns: %w", err)
	}
	return result, nil
}

func (c *Client) GetCampaign(campaignID string) (map[string]string, error) {
	key := fmt.Sprintf("campaign:%s", campaignID)
	result, err := c.rdb.HGetAll(c.ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get campaign: %w", err)
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("campaign not found: %s", campaignID)
	}
	return result, nil
}

func (c *Client) GetCampaignCreatives(campaignID string) ([]string, error) {
	key := fmt.Sprintf("campaign:%s:creatives", campaignID)
	result, err := c.rdb.SMembers(c.ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get campaign creatives: %w", err)
	}
	return result, nil
}

func (c *Client) GetRandomCreative(campaignID string) (string, error) {
	key := fmt.Sprintf("campaign:%s:creatives", campaignID)
	result, err := c.rdb.SRandMember(c.ctx, key).Result()
	if err != nil {
		return "", fmt.Errorf("failed to get random creative: %w", err)
	}
	return result, nil
}

func (c *Client) GetCreative(creativeID string) (map[string]string, error) {
	key := fmt.Sprintf("creative:%s", creativeID)
	result, err := c.rdb.HGetAll(c.ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get creative: %w", err)
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("creative not found: %s", creativeID)
	}
	return result, nil
}

func (c *Client) IncrementCampaignRequests(campaignID string) error {
	// Increment hourly request counter
	hour := time.Now().Format("2006010215")
	key := fmt.Sprintf("campaign:%s:requests:%s", campaignID, hour)
	if err := c.rdb.Incr(c.ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to increment campaign requests: %w", err)
	}
	// Set expiry to 25 hours to keep last 24 hours
	c.rdb.Expire(c.ctx, key, 25*time.Hour)
	return nil
}

func (c *Client) IncrementCreativeImpressions(creativeID string) error {
	// Increment hourly impression counter
	hour := time.Now().Format("2006010215")
	key := fmt.Sprintf("creative:%s:impressions:%s", creativeID, hour)
	if err := c.rdb.Incr(c.ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to increment creative impressions: %w", err)
	}
	// Set expiry to 25 hours to keep last 24 hours
	c.rdb.Expire(c.ctx, key, 25*time.Hour)
	return nil
}

// Test helper methods

func (c *Client) SetCampaign(campaignID string, data map[string]interface{}) error {
	key := fmt.Sprintf("campaign:%s", campaignID)

	// Convert map[string]interface{} to map[string]string for HSET
	stringData := make(map[string]string)
	for k, v := range data {
		stringData[k] = fmt.Sprintf("%v", v)
	}

	if err := c.rdb.HSet(c.ctx, key, stringData).Err(); err != nil {
		return fmt.Errorf("failed to set campaign: %w", err)
	}
	return nil
}

func (c *Client) SetCreative(creativeID, campaignID string, data map[string]interface{}) error {
	// Set creative hash
	creativeKey := fmt.Sprintf("creative:%s", creativeID)
	stringData := make(map[string]string)
	for k, v := range data {
		stringData[k] = fmt.Sprintf("%v", v)
	}

	if err := c.rdb.HSet(c.ctx, creativeKey, stringData).Err(); err != nil {
		return fmt.Errorf("failed to set creative: %w", err)
	}

	// Add to campaign's creatives set
	campaignCreativesKey := fmt.Sprintf("campaign:%s:creatives", campaignID)
	if err := c.rdb.SAdd(c.ctx, campaignCreativesKey, creativeID).Err(); err != nil {
		return fmt.Errorf("failed to add creative to campaign set: %w", err)
	}

	return nil
}

func (c *Client) AddActiveCampaign(campaignID string, score float64) error {
	if err := c.rdb.ZAdd(c.ctx, "active_campaigns", redis.Z{
		Score:  score,
		Member: campaignID,
	}).Err(); err != nil {
		return fmt.Errorf("failed to add active campaign: %w", err)
	}
	return nil
}

func (c *Client) DeleteCampaign(campaignID string) error {
	key := fmt.Sprintf("campaign:%s", campaignID)
	return c.rdb.Del(c.ctx, key).Err()
}

func (c *Client) DeleteCreative(creativeID, campaignID string) error {
	creativeKey := fmt.Sprintf("creative:%s", creativeID)
	campaignCreativesKey := fmt.Sprintf("campaign:%s:creatives", campaignID)

	c.rdb.Del(c.ctx, creativeKey)
	c.rdb.SRem(c.ctx, campaignCreativesKey, creativeID)

	return nil
}

func (c *Client) RemoveActiveCampaign(campaignID string) error {
	return c.rdb.ZRem(c.ctx, "active_campaigns", campaignID).Err()
}
