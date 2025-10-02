'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Folder, BarChart3, Settings, LogOut } from 'lucide-react';
import { authApi, tokenStorage } from '@/lib/api';
import { useRouter } from 'next/navigation';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Campaigns', href: '/campaigns', icon: Folder },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      console.log('[Logout] Starting logout...');
      await authApi.logout();
      console.log('[Logout] API call successful');
    } catch (error) {
      console.error('[Logout] API call failed:', error);
      // Continue with logout even if API call fails
    } finally {
      console.log('[Logout] Removing token and redirecting...');
      tokenStorage.removeToken();
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col w-64 bg-gray-900 min-h-screen">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">CTV Ad Server</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
}
