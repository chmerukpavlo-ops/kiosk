import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isAdmin
    ? [
        { path: '/', label: 'Дашборд', icon: '📊' },
        { path: '/products', label: 'Товари', icon: '📦' },
        { path: '/sales', label: 'Продажі', icon: '💰' },
        { path: '/kiosks', label: 'Ларьки', icon: '🏪' },
        { path: '/employees', label: 'Продавці', icon: '👥' },
        { path: '/schedule', label: 'Графік', icon: '📅' },
      ]
    : [
        { path: '/', label: 'Панель', icon: '📊' },
      ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-primary-600">Кіоск</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                <span className="font-medium">{user?.full_name}</span>
                <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                  {isAdmin ? 'Адмін' : 'Продавець'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 touch-manipulation"
              >
                Вийти
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="sm:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === item.path
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}

