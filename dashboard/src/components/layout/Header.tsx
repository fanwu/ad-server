'use client';

import { User } from '@/types/auth';

interface HeaderProps {
  user?: User;
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back!</h2>
          {user && (
            <p className="text-sm text-gray-600 mt-1">
              {user.name} ({user.role})
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
