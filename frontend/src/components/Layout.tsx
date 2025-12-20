import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { toast } from './Toast';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { actualTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const initialLowStockLoadedRef = useRef(false);
  const prevLowStockCountRef = useRef<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    products: any[];
    sales: any[];
    employees: any[];
  }>({ products: [], sales: [], employees: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  // Keyboard shortcut for global search (Ctrl+K)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && showGlobalSearch) {
        setShowGlobalSearch(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, showGlobalSearch]);

  // Close search on outside click
  useEffect(() => {
    if (!showGlobalSearch) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.global-search-container')) {
        setShowGlobalSearch(false);
        setSearchQuery('');
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showGlobalSearch]);

  // Close dropdowns on outside click (desktop)
  useEffect(() => {
    if (openDropdowns.size === 0) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown')) {
        setOpenDropdowns(new Set());
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openDropdowns]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    const loadCount = async () => {
      try {
        const res = await api.get('/stock/low/count');
        const nextCount = Number(res.data?.count || 0);
        if (cancelled) return;

        setLowStockCount(nextCount);

        if (!initialLowStockLoadedRef.current) {
          initialLowStockLoadedRef.current = true;
          prevLowStockCountRef.current = nextCount;
          return;
        }

        const prev = prevLowStockCountRef.current;
        prevLowStockCountRef.current = nextCount;

        if (nextCount > prev) {
          const diff = nextCount - prev;
          toast.info(`Нові низькі залишки: +${diff} (всього ${nextCount})`);
        }
      } catch (e) {
        // ignore polling errors (e.g. network hiccups)
      }
    };

    loadCount();
    const interval = setInterval(loadCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Global search function
  const performGlobalSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults({ products: [], sales: [], employees: [] });
      return;
    }
    
    setSearchLoading(true);
    try {
      const [productsRes, salesRes, employeesRes] = await Promise.all([
        api.get(`/products?search=${encodeURIComponent(query)}`).catch(() => ({ data: [] })),
        api.get(`/sales?search=${encodeURIComponent(query)}&limit=3`).catch(() => ({ data: [] })),
        api.get(`/employees?search=${encodeURIComponent(query)}`).catch(() => ({ data: [] })),
      ]);

      setSearchResults({
        products: Array.isArray(productsRes.data) ? productsRes.data.slice(0, 5) : [],
        sales: Array.isArray(salesRes.data) ? salesRes.data.slice(0, 3) : [],
        employees: Array.isArray(employeesRes.data) ? employeesRes.data.slice(0, 5) : [],
      });
    } catch (error) {
      console.error('Global search error:', error);
      setSearchResults({ products: [], sales: [], employees: [] });
    } finally {
      setSearchLoading(false);
    }
  };

  // Keyboard shortcut for global search (Ctrl+K)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && showGlobalSearch) {
        setShowGlobalSearch(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, showGlobalSearch]);

  // Close search on outside click
  useEffect(() => {
    if (!showGlobalSearch) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.global-search-container')) {
        setShowGlobalSearch(false);
        setSearchQuery('');
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showGlobalSearch]);

  // Navigation items with dropdown support
  const navItems = isAdmin
    ? [
        { path: '/', label: 'Дашборд', icon: '📊' },
        {
          label: 'Товари',
          icon: '📦',
          items: [
            { path: '/products', label: 'Товари', icon: '📦' },
            { path: '/stock', label: 'Залишки', icon: '🧾' },
            { path: '/inventory', label: 'Інвентаризація', icon: '📋' },
          ],
        },
        { path: '/sales', label: 'Продажі', icon: '💰' },
        { path: '/expenses', label: 'Фінанси', icon: '💳' },
        {
          label: 'Персонал',
          icon: '👥',
          items: [
            { path: '/employees', label: 'Продавці', icon: '👥' },
            { path: '/customers', label: 'Клієнти', icon: '👤' },
            { path: '/schedule', label: 'Графік', icon: '📅' },
          ],
        },
        { path: '/kiosks', label: 'Ларьки', icon: '🏪'         },
      ]
    : [
        { path: '/', label: 'Панель', icon: '📊' },
      ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">Кіоск</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-1 sm:items-center">
                {navItems.map((item, idx) => {
                  const itemKey = item.path || `dropdown-${idx}`;
                  
                  // Regular menu item
                  if (item.path) {
                    return (
                      <Link
                        key={itemKey}
                        to={item.path}
                        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors h-10 ${
                          location.pathname === item.path
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                        {isAdmin && item.path === '/stock' && lowStockCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                            {lowStockCount > 99 ? '99+' : lowStockCount}
                          </span>
                        )}
                      </Link>
                    );
                  }
                  
                  // Dropdown menu item
                  if (item.items) {
                    const isOpen = openDropdowns.has(itemKey);
                    const hasActiveChild = item.items.some(subItem => location.pathname === subItem.path);
                    
                    return (
                      <div key={itemKey} className="relative nav-dropdown flex items-center">
                        <button
                          onClick={() => {
                            const newSet = new Set(openDropdowns);
                            if (isOpen) {
                              newSet.delete(itemKey);
                            } else {
                              newSet.add(itemKey);
                            }
                            setOpenDropdowns(newSet);
                          }}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors h-10 ${
                            hasActiveChild
                              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        >
                          <span className="mr-2">{item.icon}</span>
                          {item.label}
                          <svg
                            className={`ml-2 w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {item.items.some(subItem => subItem.path === '/stock') && lowStockCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                              {lowStockCount > 99 ? '99+' : lowStockCount}
                            </span>
                          )}
                        </button>
                        
                        {isOpen && (
                          <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                            {item.items.map((subItem) => (
                              <Link
                                key={subItem.path}
                                to={subItem.path}
                                onClick={() => setOpenDropdowns(new Set())}
                                className={`flex items-center px-4 py-2 text-sm transition-colors ${
                                  location.pathname === subItem.path
                                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                              >
                                <span className="mr-2">{subItem.icon}</span>
                                {subItem.label}
                                {subItem.path === '/stock' && lowStockCount > 0 && (
                                  <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                                    {lowStockCount > 99 ? '99+' : lowStockCount}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  return null;
                })}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Global Search */}
              {isAdmin && (
                <div className="relative hidden md:block global-search-container">
                  <button
                    onClick={() => {
                      setShowGlobalSearch(!showGlobalSearch);
                      if (!showGlobalSearch) {
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      }
                    }}
                    className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Глобальний пошук (Ctrl+K)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="ml-2 text-xs text-gray-400">Ctrl+K</span>
                  </button>
                  
                  {showGlobalSearch && (
                    <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                      <div className="p-3 border-b border-gray-200">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.length >= 2) {
                              performGlobalSearch(e.target.value);
                            } else {
                              setSearchResults({ products: [], sales: [], employees: [] });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setShowGlobalSearch(false);
                              setSearchQuery('');
                            }
                          }}
                          placeholder="Пошук товарів, продажів, продавців..."
                          className="w-full input"
                          autoFocus
                        />
                      </div>
                      {searchLoading && (
                        <div className="p-4 text-center text-gray-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                        </div>
                      )}
                      {!searchLoading && searchQuery.length >= 2 && (
                        <div className="max-h-96 overflow-y-auto">
                          {searchResults.products.length === 0 && 
                           searchResults.sales.length === 0 && 
                           searchResults.employees.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">Нічого не знайдено</div>
                          ) : (
                            <>
                              {searchResults.products.length > 0 && (
                                <div className="p-2">
                                  <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Товари</div>
                                  {searchResults.products.map((product) => (
                                    <Link
                                      key={product.id}
                                      to={`/products`}
                                      onClick={() => {
                                        setShowGlobalSearch(false);
                                        setSearchQuery('');
                                      }}
                                      className="block px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm"
                                    >
                                      <div className="font-medium">{product.name}</div>
                                      <div className="text-xs text-gray-500">
                                        {product.brand} • {product.kiosk_name} • {product.quantity} шт.
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                              {searchResults.employees.length > 0 && (
                                <div className="p-2 border-t border-gray-200">
                                  <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Продавці</div>
                                  {searchResults.employees.map((employee) => (
                                    <Link
                                      key={employee.id}
                                      to={`/employees/${employee.id}`}
                                      onClick={() => {
                                        setShowGlobalSearch(false);
                                        setSearchQuery('');
                                      }}
                                      className="block px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm"
                                    >
                                      <div className="font-medium">{employee.full_name}</div>
                                      <div className="text-xs text-gray-500">{employee.kiosk_name || '—'}</div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                              {searchResults.sales.length > 0 && (
                                <div className="p-2 border-t border-gray-200">
                                  <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Продажі</div>
                                  {searchResults.sales.map((sale) => (
                                    <Link
                                      key={sale.id}
                                      to={`/sales`}
                                      onClick={() => {
                                        setShowGlobalSearch(false);
                                        setSearchQuery('');
                                      }}
                                      className="block px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm"
                                    >
                                      <div className="font-medium">{sale.product_name}</div>
                                      <div className="text-xs text-gray-500">
                                        {sale.seller_name} • {parseFloat(String(sale.price || 0)).toFixed(2)} ₴
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                <span className="font-medium">{user?.full_name}</span>
                <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                  {isAdmin ? 'Адмін' : 'Продавець'}
                </span>
              </div>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                title={actualTheme === 'dark' ? 'Світла тема' : 'Темна тема'}
              >
                {actualTheme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="btn btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 touch-manipulation"
              >
                Вийти
              </button>
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 touch-manipulation"
                aria-label="Відкрити меню"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <>
            {/* Overlay */}
            <div
              className="sm:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Menu panel */}
            <div className="sm:hidden fixed top-16 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navItems.map((item, idx) => {
                  const itemKey = item.path || `dropdown-${idx}`;
                  
                  // Regular menu item
                  if (item.path) {
                    return (
                      <Link
                        key={itemKey}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
                          location.pathname === item.path
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                        {isAdmin && item.path === '/stock' && lowStockCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                            {lowStockCount > 99 ? '99+' : lowStockCount}
                          </span>
                        )}
                      </Link>
                    );
                  }
                  
                  // Dropdown menu item for mobile
                  if (item.items) {
                    const isOpen = openDropdowns.has(`mobile-${itemKey}`);
                    const hasActiveChild = item.items.some(subItem => location.pathname === subItem.path);
                    
                    return (
                      <div key={itemKey}>
                        <button
                          onClick={() => {
                            const newSet = new Set(openDropdowns);
                            const mobileKey = `mobile-${itemKey}`;
                            if (isOpen) {
                              newSet.delete(mobileKey);
                            } else {
                              newSet.add(mobileKey);
                            }
                            setOpenDropdowns(newSet);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
                            hasActiveChild
                              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className="flex items-center">
                            <span className="mr-2">{item.icon}</span>
                            {item.label}
                          </span>
                          <svg
                            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isOpen && (
                          <div className="pl-4 mt-1 space-y-1">
                            {item.items.map((subItem) => (
                              <Link
                                key={subItem.path}
                                to={subItem.path}
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                  setOpenDropdowns(new Set());
                                }}
                                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                                  location.pathname === subItem.path
                                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                <span className="mr-2">{subItem.icon}</span>
                                {subItem.label}
                                {subItem.path === '/stock' && lowStockCount > 0 && (
                                  <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                                    {lowStockCount > 99 ? '99+' : lowStockCount}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  return null;
                })}
                {/* User info on mobile */}
                <div className="px-3 py-2.5 border-t border-gray-200 mt-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{user?.full_name}</span>
                    <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                      {isAdmin ? 'Адмін' : 'Продавець'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 page-enter">
        {children}
      </main>
    </div>
  );
}

