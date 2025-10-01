'use client';

import Link from 'next/link';
import { PlusCircle, Folder, TrendingUp, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your ad campaigns and performance</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Loading data...</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Currently running</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Impressions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">All time</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">$-</p>
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
            href="/dashboard/campaigns"
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

          <button
            disabled
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed"
          >
            <div className="bg-green-100 rounded-lg p-3">
              <PlusCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4 text-left">
              <h3 className="font-semibold text-gray-900">Create Campaign</h3>
              <p className="text-sm text-gray-600">Coming soon...</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No recent activity</p>
          <p className="text-sm mt-2">Activity will appear here once you start managing campaigns</p>
        </div>
      </div>
    </div>
  );
}
