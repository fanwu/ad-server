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

func NewClient(addr, password string) (*Client, error) {
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
