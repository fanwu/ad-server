'use client';

import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">Campaign performance and insights</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Coming Soon</h3>
        <p className="text-gray-600">
          This page will display detailed campaign analytics and performance metrics
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Features in development:
        </p>
        <ul className="text-sm text-gray-500 mt-2 space-y-1">
          <li>• Impression tracking and charts</li>
          <li>• Campaign performance comparison</li>
          <li>• Budget utilization reports</li>
          <li>• Export capabilities</li>
        </ul>
      </div>
    </div>
  );
}
