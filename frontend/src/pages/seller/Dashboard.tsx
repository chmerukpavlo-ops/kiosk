import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format, isAfter, subMinutes } from 'date-fns';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
    price: number | string;
    quantity: number;
  } | null>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [selling, setSelling] = useState(false);

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

  const handleSellClick = (product: typeof data!.products[0]) => {
    setSelectedProduct(product);
    setSellQuantity(1);
    setShowSellModal(true);
  };

  const handleSell = async () => {
    if (!selectedProduct) return;
    if (sellQuantity < 1 || sellQuantity > selectedProduct.quantity) {
      alert('Невірна кількість');
      return;
    }

    setSelling(true);
    try {
      await api.post('/sales', { product_id: selectedProduct.id, quantity: sellQuantity });
      setShowSellModal(false);
      setSelectedProduct(null);
      setSellQuantity(1);
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка продажу товару');
    } finally {
      setSelling(false);
    }
  };

  const handleCancelSale = async (saleId: number) => {
    if (!confirm('Відмінити цей продаж? Кількість товару буде відновлено.')) return;

    try {
      await api.delete(`/sales/${saleId}`);
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка відміни продажу');
    }
  };

  const canCancelSale = (createdAt: string) => {
    const saleTime = new Date(createdAt);
    const thirtyMinutesAgo = subMinutes(new Date(), 30);
    return isAfter(saleTime, thirtyMinutesAgo);
  };

  const filteredProducts = data?.products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query)
    );
  }) || [];

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
          <div className="mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold mb-2">Товари в наявності</h2>
            <input
              type="text"
              placeholder="🔍 Пошук товару..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'Нічого не знайдено' : 'Немає товарів'}
              </div>
            ) : (
              filteredProducts.map((product) => (
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
                      onClick={() => handleSellClick(product)}
                      disabled={product.quantity === 0}
                      className="btn btn-primary w-full sm:w-auto sm:ml-4 py-3 sm:py-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
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
              data.recent_sales.map((sale) => {
                const canCancel = canCancelSale(sale.created_at);
                return (
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
                      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                        <div className="text-left sm:text-right">
                          <div className="font-semibold text-green-600 text-sm sm:text-base">
                            {parseFloat(String(sale.price || 0)).toFixed(2)} ₴
                          </div>
                          <div className="text-xs text-purple-600">
                            Комісія: {parseFloat(String(sale.commission || 0)).toFixed(2)} ₴
                          </div>
                        </div>
                        {canCancel && (
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            className="btn bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 text-xs sm:text-sm rounded-lg touch-manipulation min-h-[32px]"
                          >
                            Скасувати
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sell Modal */}
      {showSellModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Продаж товару</h3>
            <div className="space-y-4">
              <div>
                <div className="font-medium text-gray-900">{selectedProduct.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Ціна: <span className="font-semibold text-green-600">
                    {parseFloat(String(selectedProduct.price || 0)).toFixed(2)} ₴
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  В наявності: <span className="font-semibold">{selectedProduct.quantity} шт.</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Кількість</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                    disabled={sellQuantity <= 1}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.quantity}
                    value={sellQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setSellQuantity(Math.max(1, Math.min(val, selectedProduct.quantity)));
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold"
                  />
                  <button
                    onClick={() => setSellQuantity(Math.min(selectedProduct.quantity, sellQuantity + 1))}
                    disabled={sellQuantity >= selectedProduct.quantity}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span>Сума:</span>
                  <span className="font-semibold text-green-600">
                    {(parseFloat(String(selectedProduct.price || 0)) * sellQuantity).toFixed(2)} ₴
                  </span>
                </div>
                <div className="flex justify-between text-sm text-purple-600">
                  <span>Комісія (12%):</span>
                  <span className="font-semibold">
                    {(parseFloat(String(selectedProduct.price || 0)) * sellQuantity * 0.12).toFixed(2)} ₴
                  </span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowSellModal(false);
                    setSelectedProduct(null);
                    setSellQuantity(1);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 touch-manipulation min-h-[44px]"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSell}
                  disabled={selling || sellQuantity < 1 || sellQuantity > selectedProduct.quantity}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] font-semibold"
                >
                  {selling ? 'Продаю...' : 'Підтвердити продаж'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
