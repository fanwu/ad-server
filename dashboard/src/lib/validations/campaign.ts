import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(255, 'Campaign name must not exceed 255 characters'),

  description: z.string()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),

  budget_total: z.number({
    message: 'Budget must be a number',
  })
    .positive('Budget must be greater than 0')
    .max(999999999, 'Budget is too large'),

  start_date: z.string()
    .min(1, 'Start date is required')
    .refine((date) => {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      return selectedDate >= yesterday;
    }, 'Start date cannot be more than 1 day in the past'),

  end_date: z.string()
    .min(1, 'End date is required'),

  pricing_model: z.enum(['cpm', 'cpc', 'cpv', 'flat'], {
    message: 'Pricing model is required',
  }),

  cpm_rate: z.number().optional().or(z.nan()),
  cpc_rate: z.number().optional().or(z.nan()),
  cpv_rate: z.number().optional().or(z.nan()),
}).refine((data) => {
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  return endDate > startDate;
}, {
  message: 'End date must be after start date',
  path: ['end_date'],
}).refine((data) => {
  // Validate that the appropriate rate is set for the pricing model
  if (data.pricing_model === 'cpm') {
    return data.cpm_rate !== undefined && !isNaN(data.cpm_rate) && data.cpm_rate > 0 && data.cpm_rate <= 1000;
  }
  if (data.pricing_model === 'cpc') {
    return data.cpc_rate !== undefined && !isNaN(data.cpc_rate) && data.cpc_rate > 0 && data.cpc_rate <= 100;
  }
  if (data.pricing_model === 'cpv') {
    return data.cpv_rate !== undefined && !isNaN(data.cpv_rate) && data.cpv_rate > 0 && data.cpv_rate <= 100;
  }
  return true;
}, (data) => {
  // Dynamic error message and path based on pricing model
  let message = 'Please enter a valid rate';
  let path: ('cpm_rate' | 'cpc_rate' | 'cpv_rate')[] = ['cpm_rate'];

  if (data.pricing_model === 'cpm') {
    message = 'CPM rate must be between $0.01 and $1,000';
    path = ['cpm_rate'];
  } else if (data.pricing_model === 'cpc') {
    message = 'CPC rate must be between $0.01 and $100';
    path = ['cpc_rate'];
  } else if (data.pricing_model === 'cpv') {
    message = 'CPV rate must be between $0.01 and $100';
    path = ['cpv_rate'];
  }

  return { message, path };
});

export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;
