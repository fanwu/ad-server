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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'Start date must be today or in the future'),

  end_date: z.string()
    .min(1, 'End date is required'),
}).refine((data) => {
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  return endDate > startDate;
}, {
  message: 'End date must be after start date',
  path: ['end_date'],
});

export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;
