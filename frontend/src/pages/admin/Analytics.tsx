import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';
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

interface TrendData {
  daily_trend: Array<{
    date: string;
    sales_count: number;
    revenue: number;
    quantity_sold: number;
  }>;
  trend_slope: number;
  predictions: Array<{
    day: number;
    predicted_revenue: number;
    date: string;
  }>;
  product_performance: Array<{
    id: number;
    name: string;
    brand?: string;
    sales_count: number;
    total_revenue: number;
  }>;
  hourly_pattern: Array<{
    hour: number;
    sales_count: number;
    revenue: number;
  }>;
  day_of_week_pattern: Array<{
    day_of_week: number;
    day_name: string;
    sales_count: number;
    revenue: number;
  }>;
  growth: {
    current_period: number;
    previous_period: number;
    growth_percent: number;
  };
}

interface ForecastData {
  historical: Array<{
    date: string;
    sales_count: number;
    revenue: number;
  }>;
  forecast: Array<{
    date: string;
    predicted_revenue: number;
    predicted_sales_count: number;
    confidence: number;
  }>;
  metrics: {
    average_daily_revenue: number;
    trend: number;
    trend_direction: 'up' | 'down' | 'stable';
  };
}

interface CategoryData {
  categories: Array<{
    category: string;
    sales_count: number;
    revenue: number;
    quantity_sold: number;
  }>;
  brands: Array<{
    brand: string;
    sales_count: number;
    revenue: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function Analytics() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trendsRes, forecastRes, categoriesRes] = await Promise.all([
        api.get(`/analytics/trends?period=${period}`),
        api.get('/analytics/forecast?days=7'),
        api.get(`/analytics/categories?period=${period}`),
      ]);

      setTrends(trendsRes.data);
      setForecast(forecastRes.data);
      setCategories(categoriesRes.data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      toast.error('Помилка завантаження аналітики');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Завантаження аналітики...</div>;
  }

  const chartData = trends?.daily_trend.map((row) => ({
    date: format(new Date(row.date), 'dd.MM', { locale: uk }),
    revenue: parseFloat(String(row.revenue || 0)),
    sales: row.sales_count,
  })) || [];

  const forecastChartData = [
    ...(forecast?.historical.slice(-7).map((row) => ({
      date: format(new Date(row.date), 'dd.MM', { locale: uk }),
      revenue: parseFloat(String(row.revenue || 0)),
      type: 'Фактичні',
    })) || []),
    ...(forecast?.forecast.map((row) => ({
      date: format(new Date(row.date), 'dd.MM', { locale: uk }),
      revenue: parseFloat(String(row.predicted_revenue || 0)),
      type: 'Прогноз',
    })) || []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Аналітика та прогнози</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as '7' | '30' | '90')}
          className="input"
        >
          <option value="7">7 днів</option>
          <option value="30">30 днів</option>
          <option value="90">90 днів</option>
        </select>
      </div>

      {/* Growth Metrics */}
      {trends?.growth && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600 dark:text-gray-400">Поточний період</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {parseFloat(String(trends.growth.current_period || 0)).toFixed(2)} ₴
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 dark:text-gray-400">Попередній період</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {parseFloat(String(trends.growth.previous_period || 0)).toFixed(2)} ₴
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 dark:text-gray-400">Зростання</div>
            <div className={`text-2xl font-bold ${
              trends.growth.growth_percent > 0 
                ? 'text-green-600 dark:text-green-400' 
                : trends.growth.growth_percent < 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {trends.growth.growth_percent > 0 ? '+' : ''}
              {trends.growth.growth_percent.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Daily Trend Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Динаміка продажів</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Виручка (₴)" />
              <Line type="monotone" dataKey="sales" stroke="#82ca9d" name="Кількість продажів" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Forecast Chart */}
      {forecastChartData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Прогноз на 7 днів</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#8884d8" 
                name="Виручка (₴)"
                strokeDasharray={forecastChartData[0]?.type === 'Прогноз' ? '5 5' : '0'}
              />
            </LineChart>
          </ResponsiveContainer>
          {forecast?.metrics && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <div>Середня денна виручка: {parseFloat(String(forecast.metrics.average_daily_revenue || 0)).toFixed(2)} ₴</div>
              <div>Тренд: {forecast.metrics.trend_direction === 'up' ? '📈 Зростання' : forecast.metrics.trend_direction === 'down' ? '📉 Спад' : '➡️ Стабільно'}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Pattern */}
        {trends?.hourly_pattern && trends.hourly_pattern.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Продажі по годинах</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends.hourly_pattern}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8884d8" name="Виручка (₴)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Day of Week Pattern */}
        {trends?.day_of_week_pattern && trends.day_of_week_pattern.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Продажі по днях тижня</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends.day_of_week_pattern}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day_name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#82ca9d" name="Виручка (₴)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Performance */}
        {categories?.categories && categories.categories.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Продажі по категоріях</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categories.categories}
                  dataKey="revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {categories.categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Products */}
        {trends?.product_performance && trends.product_performance.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Топ товари</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trends.product_performance.slice(0, 10).map((product, index) => (
                <div key={product.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      {product.brand && (
                        <div className="text-sm text-gray-500">{product.brand}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{parseFloat(String(product.total_revenue || 0)).toFixed(2)} ₴</div>
                    <div className="text-sm text-gray-500">{product.sales_count} продажів</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

