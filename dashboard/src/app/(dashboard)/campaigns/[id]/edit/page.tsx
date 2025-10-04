'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignApi } from '@/lib/api';
import { createCampaignSchema, type CreateCampaignFormData } from '@/lib/validations/campaign';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateCampaignFormData>({
    resolver: zodResolver(createCampaignSchema),
  });

  const pricingModel = watch('pricing_model');

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        setLoading(true);
        const { campaign } = await campaignApi.getById(campaignId);

        // Format dates for input fields (YYYY-MM-DD)
        const startDate = new Date(campaign.start_date).toISOString().split('T')[0];
        const endDate = new Date(campaign.end_date).toISOString().split('T')[0];

        reset({
          name: campaign.name,
          description: campaign.description || '',
          budget_total: campaign.budget_total,
          start_date: startDate,
          end_date: endDate,
          pricing_model: campaign.pricing_model,
          cpm_rate: campaign.pricing_model === 'cpm' ? campaign.cpm_rate : undefined,
          cpc_rate: campaign.pricing_model === 'cpc' ? campaign.cpc_rate : undefined,
          cpv_rate: campaign.pricing_model === 'cpv' ? campaign.cpv_rate : undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, reset]);

  const onSubmit = async (data: CreateCampaignFormData) => {
    try {
      setIsSubmitting(true);
      setError('');

      // Prepare campaign data with proper pricing fields
      const campaignData = {
        name: data.name,
        description: data.description || undefined,
        budget_total: Number(data.budget_total),
        start_date: data.start_date,
        end_date: data.end_date,
        pricing_model: data.pricing_model,
        // Ensure only the selected pricing model's rate is sent, convert null to undefined
        cpm_rate: data.pricing_model === 'cpm' ? (data.cpm_rate ?? undefined) : undefined,
        cpc_rate: data.pricing_model === 'cpc' ? (data.cpc_rate ?? undefined) : undefined,
        cpv_rate: data.pricing_model === 'cpv' ? (data.cpv_rate ?? undefined) : undefined,
      };

      await campaignApi.update(campaignId, campaignData);

      // Redirect to campaign details on success
      window.location.href = `/campaigns/${campaignId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error && !isSubmitting) {
    return (
      <div className="space-y-4">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaign
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Error loading campaign</p>
          <p className="text-red-600 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/campaigns/${campaignId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Campaign</h1>
          <p className="text-gray-600 mt-1">Update campaign details and settings</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && isSubmitting && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error updating campaign</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
        {/* Campaign Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Campaign Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            {...register('name')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Summer Sale 2025"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Describe your campaign objectives and target audience"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Budget */}
        <div>
          <label htmlFor="budget_total" className="block text-sm font-medium text-gray-700 mb-1">
            Total Budget ($) <span className="text-red-500">*</span>
          </label>
          <input
            id="budget_total"
            type="number"
            step="0.01"
            min="0"
            {...register('budget_total', { valueAsNumber: true })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="5000.00"
          />
          {errors.budget_total && (
            <p className="mt-1 text-sm text-red-600">{errors.budget_total.message}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Enter the total budget allocated for this campaign
          </p>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="start_date"
              type="date"
              {...register('start_date')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.start_date && (
              <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              id="end_date"
              type="date"
              {...register('end_date')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.end_date && (
              <p className="mt-1 text-sm text-red-600">{errors.end_date.message}</p>
            )}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Configuration</h3>

          {/* Pricing Model */}
          <div className="mb-4">
            <label htmlFor="pricing_model" className="block text-sm font-medium text-gray-700 mb-1">
              Pricing Model <span className="text-red-500">*</span>
            </label>
            <select
              id="pricing_model"
              {...register('pricing_model')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cpm">CPM - Cost Per 1000 Impressions</option>
              <option value="cpc">CPC - Cost Per Click</option>
              <option value="cpv">CPV - Cost Per View/Completion</option>
              <option value="flat">Flat - Fixed Budget</option>
            </select>
            {errors.pricing_model && (
              <p className="mt-1 text-sm text-red-600">{errors.pricing_model.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {pricingModel === 'cpm' && 'You will be charged for every 1000 ad impressions'}
              {pricingModel === 'cpc' && 'You will be charged only when viewers click your ad'}
              {pricingModel === 'cpv' && 'You will be charged when viewers watch your ad to completion'}
              {pricingModel === 'flat' && 'Fixed budget with no per-unit pricing'}
            </p>
          </div>

          {/* Pricing Rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CPM Rate */}
            <div>
              <label htmlFor="cpm_rate" className="block text-sm font-medium text-gray-700 mb-1">
                CPM Rate ($) {pricingModel === 'cpm' && <span className="text-red-500">*</span>}
              </label>
              <input
                id="cpm_rate"
                type="number"
                step="0.01"
                min="0"
                disabled={pricingModel !== 'cpm'}
                {...register('cpm_rate', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="5.00"
              />
              {errors.cpm_rate && (
                <p className="mt-1 text-sm text-red-600">{errors.cpm_rate.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Per 1000 impressions</p>
            </div>

            {/* CPC Rate */}
            <div>
              <label htmlFor="cpc_rate" className="block text-sm font-medium text-gray-700 mb-1">
                CPC Rate ($) {pricingModel === 'cpc' && <span className="text-red-500">*</span>}
              </label>
              <input
                id="cpc_rate"
                type="number"
                step="0.01"
                min="0"
                disabled={pricingModel !== 'cpc'}
                {...register('cpc_rate', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="0.50"
              />
              {errors.cpc_rate && (
                <p className="mt-1 text-sm text-red-600">{errors.cpc_rate.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Per click</p>
            </div>

            {/* CPV Rate */}
            <div>
              <label htmlFor="cpv_rate" className="block text-sm font-medium text-gray-700 mb-1">
                CPV Rate ($) {pricingModel === 'cpv' && <span className="text-red-500">*</span>}
              </label>
              <input
                id="cpv_rate"
                type="number"
                step="0.01"
                min="0"
                disabled={pricingModel !== 'cpv'}
                {...register('cpv_rate', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="0.25"
              />
              {errors.cpv_rate && (
                <p className="mt-1 text-sm text-red-600">{errors.cpv_rate.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Per completed view</p>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href={`/campaigns/${campaignId}`}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
