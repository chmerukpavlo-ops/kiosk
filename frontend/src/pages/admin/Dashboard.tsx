import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';

interface DashboardData {
  cards: {
    total_products: number;
    revenue_today: number;
    sales_today: number;
    expenses_today?: number;
    purchase_cost_today?: number;
    margin_today?: number;
    margin_percent_today?: number;
  };
  chart: Array<{ 
    date: string; 
    sales_count: number; 
    revenue: number;
    expenses?: number;
    purchase_cost?: number;
    margin?: number;
    margin_percent?: number;
  }>;
  recent_sales: any[];
  top_sellers: any[];
  top_products: any[];
  sales_by_type?: Array<{
    type: string;
    sales_count: number;
    revenue: number;
  }>;
  sales_by_hour?: Array<{
    hour: number;
    sales_count: number;
    revenue: number;
  }>;
}

interface ForecastData {
  forecast: {
    revenue: number;
    expenses: number;
    purchase_cost: number;
    profit: number;
    margin: number;
    margin_percent: number;
  };
  trends: {
    revenue_growth: number;
    expenses_growth: number;
  };
  current_month: {
    revenue: number;
    expenses: number;
  };
}

interface Recommendation {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  category?: string;
  current_amount?: number;
  previous_amount?: number;
  increase_percent?: number;
  products?: Array<{ id: number; name: string; margin_percent: number; margin: number }>;
  count?: number;
}

interface Notification {
  type: 'overdue_expense' | 'upcoming_expense' | 'low_stock' | 'schedule';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  count: number;
  items?: Array<{
    id: number;
    description: string;
    amount: number;
    planned_for: string;
    kiosk_name?: string;
    category: string;
  }>;
  link?: string;
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // На мобільних за замовчуванням згорнуто
  const [cardsCollapsed, setCardsCollapsed] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'7' | '30' | '90' | '365'>('30');

  useEffect(() => {
    loadData();
    loadForecast();
    loadRecommendations();
    loadNotifications();
    
    // Оновлюємо нагадування кожні 5 хвилин
    const interval = setInterval(() => {
      loadNotifications();
    }, 5 * 60 * 1000); // 5 хвилин
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriod]);

  const loadData = async () => {
    try {
      const response = await api.get('/stats/dashboard', {
        params: { period: chartPeriod }
      });
      if (response.data) {
        setData(response.data);
      } else {
        setData(null);
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setData(null);
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast.error('Помилка завантаження даних дашборду');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async () => {
    try {
      const response = await api.get('/finance/forecast');
      if (response.data) {
        setForecast(response.data);
      }
    } catch (error) {
      console.error('Failed to load forecast:', error);
      setForecast(null);
    }
  };

  const loadRecommendations = async () => {
    try {
      const response = await api.get('/finance/recommendations');
      if (response.data && Array.isArray(response.data.recommendations)) {
        setRecommendations(response.data.recommendations);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setRecommendations([]);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await api.get('/stats/notifications');
      if (response.data && Array.isArray(response.data.notifications)) {
        setNotifications(response.data.notifications);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Завантаження...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Помилка завантаження даних</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Не вдалося завантажити дані дашборду</p>
        <button
          onClick={() => {
            setLoading(true);
            loadData();
            loadForecast();
            loadRecommendations();
          }}
          className="btn btn-primary"
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Дашборд адміністратора</h1>
        {/* Collapse button - на мобільних завжди видима, на десктопі опціональна */}
        <button
          onClick={() => setCardsCollapsed(!cardsCollapsed)}
          className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 touch-manipulation md:opacity-70 md:hover:opacity-100"
          aria-label={cardsCollapsed ? 'Розгорнути статистику' : 'Згорнути статистику'}
          title={cardsCollapsed ? 'Розгорнути статистику' : 'Згорнути статистику'}
        >
          {cardsCollapsed ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 transition-all duration-300 ${cardsCollapsed ? 'hidden md:grid' : 'grid'}`}>
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90 mb-1">Наявність товарів</div>
          <div className="text-2xl font-bold">{data.cards.total_products}</div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-90 mb-1">Виручка за день</div>
          <div className="text-2xl font-bold">
            {parseFloat(String(data.cards.revenue_today || 0)).toFixed(2)} ₴
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="text-sm opacity-90 mb-1">Витрати за день</div>
          <div className="text-2xl font-bold">
            {(data.cards.expenses_today || 0).toFixed(2)} ₴
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90 mb-1">Собівартість</div>
          <div className="text-2xl font-bold">
            {parseFloat(String(data.cards.purchase_cost_today || 0)).toFixed(2)} ₴
          </div>
        </div>

        <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="text-sm opacity-90 mb-1">Маржа за день</div>
          <div className="text-2xl font-bold">
            {parseFloat(String(data.cards.margin_today || 0)).toFixed(2)} ₴
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="text-sm opacity-90 mb-1">Маржинальність</div>
          <div className="text-2xl font-bold">
            {(data.cards.margin_percent_today || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Notifications/Reminders */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notif, idx) => (
            <div
              key={idx}
              className={`card border-l-4 ${
                notif.severity === 'high'
                  ? 'bg-red-50 border-red-500'
                  : notif.severity === 'medium'
                  ? 'bg-amber-50 border-amber-500'
                  : 'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <span className="mr-2">
                      {notif.type === 'overdue_expense' ? '🔴' : 
                       notif.type === 'upcoming_expense' ? '🟡' : 
                       notif.type === 'low_stock' ? '📦' : 
                       notif.type === 'schedule' ? '📅' : '🔔'}
                    </span>
                    {notif.title}
                    {notif.count > 0 && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                        notif.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {notif.count}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">{notif.message}</p>
                  {notif.items && notif.items.length > 0 && (
                    <div className="space-y-2">
                      {notif.items.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{item.description}</div>
                            <div className="text-xs text-gray-500">
                              {item.kiosk_name && `${item.kiosk_name} • `}
                              {format(new Date(item.planned_for), 'dd.MM.yyyy', { locale: uk })}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 ml-4">
                            {parseFloat(String(item.amount || 0)).toFixed(2)} ₴
                          </div>
                        </div>
                      ))}
                      {notif.items.length > 5 && (
                        <div className="text-xs text-gray-500 text-center pt-1">
                          + ще {notif.items.length - 5} витрат
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {notif.link && (
                  <Link
                    to={notif.link}
                    className="ml-4 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors whitespace-nowrap"
                  >
                    Переглянути →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="card bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">💡</span>
            Рекомендації щодо оптимізації
          </h2>
          <div className="space-y-3">
            {recommendations.slice(0, 5).map((rec, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  rec.severity === 'high'
                    ? 'bg-red-50 border border-red-200'
                    : rec.severity === 'medium'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <div className="flex items-start">
                  <span className="mr-2">
                    {rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🔵'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{rec.message}</p>
                    {rec.products && rec.products.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <strong>Товари з низькою маржею:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {rec.products.slice(0, 3).map((p) => (
                            <li key={p.id}>
                              {p.name} (маржа: {parseFloat(String(p.margin_percent || 0)).toFixed(1)}%)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast && forecast.forecast && forecast.trends && forecast.current_month && (
        <div className="card bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-800/50 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center dark:text-gray-100">
            <span className="mr-2">📈</span>
            Прогноз на наступний місяць
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Прогноз виручки</div>
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {parseFloat(String(forecast.forecast.revenue || 0)).toFixed(2)} ₴
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {forecast.trends.revenue_growth >= 0 ? '↑' : '↓'}{' '}
                {Math.abs(parseFloat(String(forecast.trends.revenue_growth || 0))).toFixed(1)}% зростання
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Прогноз витрат</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {parseFloat(String(forecast.forecast.expenses || 0)).toFixed(2)} ₴
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {forecast.trends.expenses_growth >= 0 ? '↑' : '↓'}{' '}
                {Math.abs(parseFloat(String(forecast.trends.expenses_growth || 0))).toFixed(1)}% зміна
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Прогноз прибутку</div>
              <div
                className={`text-2xl font-bold ${
                  parseFloat(String(forecast.forecast.profit || 0)) >= 0 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {parseFloat(String(forecast.forecast.profit || 0)).toFixed(2)} ₴
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Маржа: {parseFloat(String(forecast.forecast.margin_percent || 0)).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Поточний місяць</div>
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Виручка: {parseFloat(String(forecast.current_month.revenue || 0)).toFixed(2)} ₴
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Витрати: {parseFloat(String(forecast.current_month.expenses || 0)).toFixed(2)} ₴
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="text-sm opacity-90 mb-1">Прибуток за день</div>
          <div className="text-2xl font-bold">
            {((data.cards.revenue_today || 0) - (data.cards.expenses_today || 0) - (data.cards.purchase_cost_today || 0)).toFixed(2)} ₴
          </div>
          <div className="text-xs mt-2 opacity-80">
            Виручка: {parseFloat(String(data.cards.revenue_today || 0)).toFixed(2)} ₴
          </div>
        </div>
        <div className="card bg-gradient-to-br from-slate-600 to-slate-700 text-white">
          <div className="text-sm opacity-90 mb-1">Витрати за день</div>
          <div className="text-2xl font-bold">
            {(data.cards.expenses_today || 0).toFixed(2)} ₴
          </div>
          <div className="text-xs mt-2 opacity-80">
            Собівартість: {parseFloat(String(data.cards.purchase_cost_today || 0)).toFixed(2)} ₴
          </div>
        </div>
        <div className="card bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <div className="text-sm opacity-90 mb-1">Маржинальність</div>
          <div className="text-2xl font-bold">
            {(data.cards.margin_percent_today || 0).toFixed(1)}%
          </div>
          <div className="text-xs mt-2 opacity-80">
            Маржа: {parseFloat(String(data.cards.margin_today || 0)).toFixed(2)} ₴
          </div>
        </div>
      </div>

      {/* Chart */}
      {data.chart && data.chart.length > 0 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Фінансова динаміка</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setChartPeriod('7')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chartPeriod === '7'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                7 днів
              </button>
              <button
                onClick={() => setChartPeriod('30')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chartPeriod === '30'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                30 днів
              </button>
              <button
                onClick={() => setChartPeriod('90')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chartPeriod === '90'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                3 місяці
              </button>
              <button
                onClick={() => setChartPeriod('365')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chartPeriod === '365'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Рік
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'dd.MM', { locale: uk })}
            />
            <YAxis />
            <Tooltip 
              formatter={(value: number | string, name: string) => {
                const nameMap: { [key: string]: string } = {
                  'revenue': 'Виручка',
                  'expenses': 'Витрати',
                  'margin': 'Прибуток',
                  'Виручка (₴)': 'Виручка',
                  'Витрати (₴)': 'Витрати',
                  'Маржа (₴)': 'Прибуток',
                };
                const displayName = nameMap[name] || name;
                return [`${parseFloat(String(value || 0)).toFixed(2)} ₴`, displayName];
              }}
              labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy', { locale: uk })}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              name="Виручка (₴)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              name="Витрати (₴)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="margin"
              stroke="#14b8a6"
              name="Маржа (₴)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Type Chart */}
        {data.sales_by_type && data.sales_by_type.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Розподіл продажів по типах товарів</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.sales_by_type.map(item => ({
                    name: item.type || 'Інше',
                    value: parseFloat(String(item.revenue || 0)),
                    count: item.sales_count || 0,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.sales_by_type.map((entry, index) => {
                    const colors = [
                      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                    ];
                    return (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    );
                  })}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${parseFloat(String(value || 0)).toFixed(2)} ₴ (${props.payload.count} продажів)`,
                    'Виручка'
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sales by Hour Chart */}
        {data.sales_by_hour && data.sales_by_hour.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Продажі по годинах дня</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sales_by_hour.map(item => ({
                hour: `${item.hour}:00`,
                sales_count: item.sales_count || 0,
                revenue: parseFloat(String(item.revenue || 0)),
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') {
                      return [`${parseFloat(String(value || 0)).toFixed(2)} ₴`, 'Виручка'];
                    }
                    return [value, 'Кількість продажів'];
                  }}
                />
                <Legend />
                <Bar dataKey="sales_count" fill="#3b82f6" name="Кількість продажів" />
                <Bar dataKey="revenue" fill="#10b981" name="Виручка (₴)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Останні продажі</h2>
            <Link
              to="/sales"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Всі продажі →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Продавець</th>
                  <th>Сума</th>
                  <th>Час</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_sales && data.recent_sales.length > 0 ? (
                  data.recent_sales.slice(0, 10).map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.product_name}</td>
                      <td>{sale.seller_name}</td>
                      <td>{parseFloat(String(sale.price || 0)).toFixed(2)} ₴</td>
                      <td className="text-xs text-gray-500">
                        {format(new Date(sale.created_at), 'HH:mm', { locale: uk })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      Немає продажів
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Sellers */}
        <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Топ продавців (сьогодні)</h2>
              <Link
                to="/employees"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Всі продавці →
              </Link>
            </div>
            <div className="space-y-3">
              {data.top_sellers && data.top_sellers.length > 0 ? (
                data.top_sellers.map((seller, index) => (
                  <Link
                    key={seller.id}
                    to={`/employees/${seller.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-primary-100 text-primary-700'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{seller.full_name}</div>
                    <div className="text-sm text-gray-500">
                      {seller.sales_count || 0} продажів
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-semibold text-green-600">
                    {parseFloat(String(seller.revenue || 0)).toFixed(2)} ₴
                  </div>
                  <div className="text-xs text-gray-500">виручка</div>
                </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">Немає даних</div>
              )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Топ товарів (сьогодні)</h2>
          <Link
            to="/products"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Всі товари →
          </Link>
        </div>
        <div className="space-y-3">
          {data.top_products && data.top_products.length > 0 ? (
            data.top_products.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-primary-100 text-primary-700'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{product.name}</div>
                    <div className="text-sm text-gray-500">
                      {product.brand && `${product.brand} • `}
                      {product.sales_count || 0} продажів
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="font-semibold text-green-600">
                    {parseFloat(String(product.revenue || 0)).toFixed(2)} ₴
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">виручка</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">Немає даних</div>
          )}
        </div>
      </div>
    </div>
  );
}

