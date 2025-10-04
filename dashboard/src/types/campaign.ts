export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type PricingModel = 'cpm' | 'cpc' | 'cpv' | 'flat';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  budget_total: number;
  budget_spent: number;
  start_date: string;
  end_date: string;
  pricing_model: PricingModel;
  cpm_rate: number | null;
  cpc_rate: number | null;
  cpv_rate: number | null;
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
  pricing_model?: PricingModel;
  cpm_rate?: number;
  cpc_rate?: number;
  cpv_rate?: number;
}

export interface UpdateCampaignStatusDto {
  status: CampaignStatus;
}
