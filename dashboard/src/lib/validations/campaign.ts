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
    required_error: 'Budget is required',
    invalid_type_error: 'Budget must be a number',
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
    required_error: 'Pricing model is required',
  }),

  cpm_rate: z.number()
    .positive('CPM rate must be greater than 0')
    .max(1000, 'CPM rate cannot exceed $1,000')
    .optional()
    .nullable(),

  cpc_rate: z.number()
    .positive('CPC rate must be greater than 0')
    .max(100, 'CPC rate cannot exceed $100')
    .optional()
    .nullable(),

  cpv_rate: z.number()
    .positive('CPV rate must be greater than 0')
    .max(100, 'CPV rate cannot exceed $100')
    .optional()
    .nullable(),
}).refine((data) => {
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  return endDate > startDate;
}, {
  message: 'End date must be after start date',
  path: ['end_date'],
}).refine((data) => {
  // Validate that the appropriate rate is set for the pricing model
  if (data.pricing_model === 'cpm' && (!data.cpm_rate || data.cpm_rate <= 0)) {
    return false;
  }
  if (data.pricing_model === 'cpc' && (!data.cpc_rate || data.cpc_rate <= 0)) {
    return false;
  }
  if (data.pricing_model === 'cpv' && (!data.cpv_rate || data.cpv_rate <= 0)) {
    return false;
  }
  return true;
}, {
  message: 'Please enter a rate for the selected pricing model',
  path: ['cpm_rate'], // Will show on whichever field is relevant
});

export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;
