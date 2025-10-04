'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Folder, TrendingUp, DollarSign, Eye, Play } from 'lucide-react';
import { analyticsApi, campaignApi } from '@/lib/api';
import { SummaryAnalytics } from '@/types/analytics';
import { Campaign } from '@/types/campaign';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<SummaryAnalytics | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [analyticsData, campaignsData] = await Promise.all([
          analyticsApi.getSummary(),
          campaignApi.getAll(),
        ]);
        setAnalytics(analyticsData);
        // Get 5 most recent campaigns
        setRecentCampaigns(campaignsData.campaigns.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
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

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your ad campaigns and performance</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '-' : formatNumber(analytics?.summary.totalCampaigns || 0)}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            {loading ? 'Loading...' : 'All campaigns'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '-' : formatNumber(analytics?.summary.activeCampaigns || 0)}
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <Play className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Currently running</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Impressions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '-' : formatNumber(analytics?.summary.totalImpressions || 0)}
              </p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <Eye className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">All time</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '$-' : `$${formatNumber(Math.round(analytics?.summary.totalBudget || 0))}`}
              </p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Across all campaigns</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/campaigns"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="bg-blue-100 rounded-lg p-3 group-hover:bg-blue-200 transition-colors">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">View Campaigns</h3>
              <p className="text-sm text-gray-600">Manage your ad campaigns</p>
            </div>
          </Link>

          <Link
            href="/campaigns/new"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="bg-green-100 rounded-lg p-3 group-hover:bg-green-200 transition-colors">
              <PlusCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Create Campaign</h3>
              <p className="text-sm text-gray-600">Start a new ad campaign</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Campaigns</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <p>Loading campaigns...</p>
          </div>
        ) : recentCampaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No campaigns yet</p>
            <p className="text-sm mt-2">Create your first campaign to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                          campaign.status
                        )}`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                        {campaign.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Budget: ${formatNumber(Math.round(campaign.budget_total))}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(campaign.start_date), 'MMM d, yyyy')} -{' '}
                        {format(new Date(campaign.end_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
