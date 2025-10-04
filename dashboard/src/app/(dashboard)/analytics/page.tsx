'use client';

import useSWR from 'swr';
import { analyticsApi } from '@/lib/api';
import { BarChart3, Eye, MousePointer, CheckCircle, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const { data, error, isLoading } = useSWR('analytics-summary', () => analyticsApi.getSummary());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">Campaign performance and insights</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Analytics error:', error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">Campaign performance and insights</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <p className="text-red-600 mb-2">Failed to load analytics data</p>
          <p className="text-sm text-gray-600">
            {error?.message || 'Unknown error'}
          </p>
          {error?.status === 401 && (
            <p className="text-sm text-gray-500 mt-2">Please try logging in again</p>
          )}
        </div>
      </div>
    );
  }

  const { summary, timeSeries, topCampaigns } = data!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">Campaign performance and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Impressions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {summary.totalImpressions.toLocaleString()}
              </p>
            </div>
            <Eye className="w-12 h-12 text-blue-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {summary.totalClicks.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">CTR: {summary.ctr}%</p>
            </div>
            <MousePointer className="w-12 h-12 text-green-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {summary.totalCompletions.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Rate: {summary.completionRate}%</p>
            </div>
            <CheckCircle className="w-12 h-12 text-purple-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Budget Spent</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${summary.totalSpent.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                of ${summary.totalBudget.toLocaleString()} ({summary.budgetUtilization}%)
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-yellow-500 opacity-80" />
          </div>
        </div>
      </div>

      {/* Campaign Status Overview */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{summary.totalCampaigns}</p>
            <p className="text-sm text-gray-600 mt-1">Total Campaigns</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{summary.activeCampaigns}</p>
            <p className="text-sm text-gray-600 mt-1">Active</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-700">{summary.pausedCampaigns}</p>
            <p className="text-sm text-gray-600 mt-1">Paused</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">{summary.completedCampaigns}</p>
            <p className="text-sm text-gray-600 mt-1">Completed</p>
          </div>
        </div>
      </div>

      {/* Time Series Chart */}
      {timeSeries.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Impressions Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="completions" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Campaigns */}
      {topCampaigns.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Campaigns</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impressions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spend
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCampaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                        campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.impressions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.clicks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.ctr}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${campaign.spend.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.totalCampaigns === 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaign Data</h3>
          <p className="text-gray-600">
            Create your first campaign to start seeing analytics
          </p>
        </div>
      )}
    </div>
  );
}
