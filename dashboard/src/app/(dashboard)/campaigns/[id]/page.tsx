'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, creativeApi } from '@/lib/api';
import { Campaign } from '@/types/campaign';
import { Creative } from '@/types/creative';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, Film, Trash2, Play } from 'lucide-react';
import { format } from 'date-fns';

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingCreativeId, setDeletingCreativeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [campaignData, creativesData] = await Promise.all([
          campaignApi.getById(campaignId),
          creativeApi.getByCampaign(campaignId),
        ]);
        setCampaign(campaignData.campaign);
        setCreatives(creativesData.creatives);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch campaign details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId]);

  const handleDeleteCreative = async (creativeId: string) => {
    if (!confirm('Are you sure you want to delete this creative? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingCreativeId(creativeId);
      await creativeApi.delete(creativeId);
      // Remove from local state
      setCreatives((prev) => prev.filter((c) => c.id !== creativeId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete creative');
    } finally {
      setDeletingCreativeId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href="/campaigns"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaigns
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Error loading campaign</p>
          <p className="text-red-600 text-sm mt-2">{error || 'Campaign not found'}</p>
        </div>
      </div>
    );
  }

  const budgetPercentage = (campaign.budget_spent / campaign.budget_total) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/campaigns"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaigns
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
            {campaign.description && (
              <p className="text-gray-600 mt-2">{campaign.description}</p>
            )}
          </div>
          <span
            className={`px-4 py-2 text-sm font-semibold rounded-full border ${getStatusColor(
              campaign.status
            )}`}
          >
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${campaign.budget_total.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Spent</span>
              <span className="font-medium">${campaign.budget_spent.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {budgetPercentage.toFixed(1)}% of budget used
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Duration</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {Math.ceil(
                  (new Date(campaign.end_date).getTime() -
                    new Date(campaign.start_date).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{' '}
                days
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Start:</span>
              <span className="font-medium">
                {format(new Date(campaign.start_date), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">End:</span>
              <span className="font-medium">
                {format(new Date(campaign.end_date), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Impressions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Analytics coming soon</p>
        </div>
      </div>

      {/* Creatives Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Creatives</h2>
          <Link
            href={`/campaigns/${campaignId}/creatives/new`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
          >
            Upload Creative
          </Link>
        </div>

        {creatives.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Film className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No creatives uploaded</p>
            <p className="text-gray-500 text-sm mt-1">
              Upload video creatives to start serving ads
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatives.map((creative) => (
              <div
                key={creative.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <Film className="w-8 h-8 text-blue-600" />
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        creative.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : creative.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : creative.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {creative.status}
                    </span>
                    <button
                      onClick={() => handleDeleteCreative(creative.id)}
                      disabled={deletingCreativeId === creative.id}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete creative"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-medium text-gray-900 mb-2">{creative.name}</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{creative.duration}s</span>
                  </div>
                  {creative.file_size && (
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-medium">
                        {(creative.file_size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-medium uppercase">{creative.format}</span>
                  </div>
                </div>
                {creative.status === 'active' && creative.video_url && (
                  <a
                    href={creative.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Play className="w-4 h-4" />
                    Preview Video
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign Details */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-600">Campaign ID</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{campaign.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Pricing Model</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {campaign.pricing_model.toUpperCase()}
              {campaign.pricing_model === 'cpm' && campaign.cpm_rate &&
                ` - $${Number(campaign.cpm_rate).toFixed(2)} per 1,000 impressions`}
              {campaign.pricing_model === 'cpc' && campaign.cpc_rate &&
                ` - $${Number(campaign.cpc_rate).toFixed(2)} per click`}
              {campaign.pricing_model === 'cpv' && campaign.cpv_rate &&
                ` - $${Number(campaign.cpv_rate).toFixed(2)} per view`}
              {campaign.pricing_model === 'flat' && ' - Fixed budget'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {format(new Date(campaign.created_at), 'MMM d, yyyy h:mm a')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {format(new Date(campaign.updated_at), 'MMM d, yyyy h:mm a')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Created By</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{campaign.created_by}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
