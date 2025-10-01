export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  budget_total: number;
  budget_spent: number;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignDto {
  name: string;
  description?: string;
  budget_total: number;
  start_date: string;
  end_date: string;
}

export interface UpdateCampaignStatusDto {
  status: CampaignStatus;
}
