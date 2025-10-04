export interface SummaryAnalytics {
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    pausedCampaigns: number;
    completedCampaigns: number;
    totalBudget: number;
    totalSpent: number;
    budgetRemaining: number;
    budgetUtilization: number;
    totalImpressions: number;
    totalClicks: number;
    totalCompletions: number;
    ctr: number;
    completionRate: number;
  };
  timeSeries: TimeSeriesData[];
  topCampaigns: TopCampaign[];
}

export interface TimeSeriesData {
  date: string;
  impressions: number;
  clicks: number;
  completions: number;
  spend: number;
}

export interface TopCampaign {
  id: string;
  name: string;
  status: string;
  budgetTotal: number;
  budgetSpent: number;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

export interface CampaignAnalytics {
  dailyStats: DailyStats[];
  creativeBreakdown: CreativeBreakdown[];
}

export interface DailyStats {
  date: string;
  impressions: number;
  clicks: number;
  completions: number;
  spend: number;
  ctr: number;
  completionRate: number;
}

export interface CreativeBreakdown {
  id: string;
  name: string;
  videoUrl: string;
  status: string;
  impressions: number;
  completions: number;
  completionRate: number;
}
