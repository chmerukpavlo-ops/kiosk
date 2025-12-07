import { useEffect, useState } from 'react';
import api from '../../lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface DashboardData {
  cards: {
    total_products: number;
    revenue_today: number;
    commission_today: number;
    sales_today: number;
  };
  chart: Array<{ date: string; sales_count: number; revenue: number }>;
  recent_sales: any[];
  top_sellers: any[];
  top_products: any[];
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.get('/stats/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Завантаження...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Помилка завантаження даних</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Дашборд адміністратора</h1>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90 mb-1">Наявність товарів</div>
          <div className="text-3xl font-bold">{data.cards.total_products}</div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-90 mb-1">Виручка за день</div>
          <div className="text-3xl font-bold">
            {data.cards.revenue_today.toFixed(2)} ₴
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90 mb-1">Комісія працівників</div>
          <div className="text-3xl font-bold">
            {data.cards.commission_today.toFixed(2)} ₴
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="text-sm opacity-90 mb-1">Проданих товарів сьогодні</div>
          <div className="text-3xl font-bold">{data.cards.sales_today}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Графік продажів по днях</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'dd.MM', { locale: uk })}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="sales_count"
              stroke="#0ea5e9"
              name="Кількість продажів"
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              name="Виручка (₴)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Останні продажі</h2>
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
                {data.recent_sales.slice(0, 10).map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.product_name}</td>
                    <td>{sale.seller_name}</td>
                    <td>{parseFloat(sale.price).toFixed(2)} ₴</td>
                    <td className="text-xs text-gray-500">
                      {format(new Date(sale.created_at), 'HH:mm', { locale: uk })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Sellers */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Топ продавців</h2>
          <div className="space-y-3">
            {data.top_sellers.map((seller, index) => (
              <div
                key={seller.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{seller.full_name}</div>
                    <div className="text-sm text-gray-500">
                      {seller.sales_count} продажів
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    {parseFloat(String(seller.commission || 0)).toFixed(2)} ₴
                  </div>
                  <div className="text-xs text-gray-500">комісія</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Топ товарів</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Назва</th>
                <th>Бренд</th>
                <th>Продажів</th>
                <th>Виручка</th>
              </tr>
            </thead>
            <tbody>
              {data.top_products.map((product) => (
                <tr key={product.id}>
                  <td className="font-medium">{product.name}</td>
                  <td>{product.brand || '-'}</td>
                  <td>{product.sales_count}</td>
                  <td className="font-semibold text-green-600">
                    {parseFloat(String(product.revenue || 0)).toFixed(2)} ₴
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

