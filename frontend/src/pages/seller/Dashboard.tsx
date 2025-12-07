import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface SellerDashboardData {
  cards: {
    total_products: number;
    total_quantity: number;
    revenue_today: number | string;
    commission_today: number | string;
  };
  products: Array<{
    id: number;
    name: string;
    brand?: string;
    price: number | string;
    quantity: number;
  }>;
  recent_sales: Array<{
    id: number;
    product_name: string;
    price: number | string;
    commission: number | string;
    created_at: string;
  }>;
}

export function SellerDashboard() {
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.get('/stats/seller');
      setData(response.data || null);
    } catch (error: any) {
      console.error('Failed to load seller dashboard:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        alert('Немає доступу до цієї сторінки');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (productId: number) => {
    if (!confirm('Підтвердити продаж товару?')) return;

    try {
      await api.post('/sales', { product_id: productId, quantity: 1 });
      alert('Товар успішно продано!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка продажу товару');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Завантаження...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Помилка завантаження даних</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Панель продавця</h1>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 sm:p-6">
          <div className="text-xs sm:text-sm opacity-90 mb-1">Наявність товару</div>
          <div className="text-xl sm:text-2xl font-bold">{data.cards.total_quantity} шт.</div>
          <div className="text-xs opacity-75 mt-1">{data.cards.total_products} позицій</div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white p-4 sm:p-6">
          <div className="text-xs sm:text-sm opacity-90 mb-1">Моя виручка</div>
          <div className="text-xl sm:text-2xl font-bold">{parseFloat(String(data.cards.revenue_today || 0)).toFixed(2)} ₴</div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 sm:p-6">
          <div className="text-xs sm:text-sm opacity-90 mb-1">Моя комісія (12%)</div>
          <div className="text-xl sm:text-2xl font-bold">{parseFloat(String(data.cards.commission_today || 0)).toFixed(2)} ₴</div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 sm:p-6">
          <div className="text-xs sm:text-sm opacity-90 mb-1">Продано сьогодні</div>
          <div className="text-xl sm:text-2xl font-bold">{data.recent_sales.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Products */}
        <div className="card">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Товари в наявності</h2>
          <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {data.products.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Немає товарів</div>
            ) : (
              data.products.map((product) => (
                <div
                  key={product.id}
                  className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm sm:text-base">{product.name}</div>
                      {product.brand && (
                        <div className="text-xs sm:text-sm text-gray-600 mt-1">{product.brand}</div>
                      )}
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-2 text-xs sm:text-sm">
                        <span className="text-gray-600">
                          Кількість: <span className="font-semibold">{product.quantity}</span>
                        </span>
                        <span className="font-semibold text-green-600">
                          {parseFloat(String(product.price || 0)).toFixed(2)} ₴
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSell(product.id)}
                      disabled={product.quantity === 0}
                      className="btn btn-primary w-full sm:w-auto sm:ml-4 py-2.5 sm:py-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      Продати
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Історія моїх продажів</h2>
          <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {data.recent_sales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Немає продажів</div>
            ) : (
              data.recent_sales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm sm:text-base">{sale.product_name}</div>
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">
                        {format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-semibold text-green-600 text-sm sm:text-base">
                        {parseFloat(String(sale.price || 0)).toFixed(2)} ₴
                      </div>
                      <div className="text-xs text-purple-600">
                        Комісія: {parseFloat(String(sale.commission || 0)).toFixed(2)} ₴
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

