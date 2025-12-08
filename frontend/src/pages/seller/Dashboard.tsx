import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { format, isAfter, subMinutes } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';

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

interface CartItem {
  product_id: number;
  name: string;
  price: number | string;
  quantity: number;
  maxQuantity: number;
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const CACHE_DURATION = 30000; // 30 секунд кешування

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    // Кешування - не завантажуємо якщо минуло менше 30 секунд
    if (!force && now - lastFetchTime < CACHE_DURATION && data) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/stats/seller');
      setData(response.data || null);
      setLastFetchTime(now);
    } catch (error: any) {
      console.error('Failed to load seller dashboard:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        toast.error('Немає доступу до цієї сторінки');
      } else {
        toast.error('Помилка завантаження даних');
      }
    } finally {
      setLoading(false);
    }
  }, [lastFetchTime, data]);

  useEffect(() => {
    loadData();
    // Автооновлення кожні 60 секунд
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSellClick = (product: typeof data!.products[0]) => {
    setSelectedProduct(product);
    setSellQuantity(1);
    setShowSellModal(true);
  };

  const handleAddToCart = (product: typeof data!.products[0]) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      if (existingItem.quantity < product.quantity) {
        setCart(
          cart.map((item) =>
            item.product_id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
        toast.success(`${product.name} додано до чеку`);
      } else {
        toast.error('Максимальна кількість досягнута');
      }
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          maxQuantity: product.quantity,
        },
      ]);
      toast.success(`${product.name} додано до чеку`);
    }
    setShowCart(true);
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product_id !== productId));
    if (cart.length === 1) {
      setShowCart(false);
    }
  };

  const handleUpdateCartQuantity = (productId: number, newQuantity: number) => {
    setCart(
      cart.map((item) => {
        if (item.product_id === productId) {
          const quantity = Math.max(1, Math.min(newQuantity, item.maxQuantity));
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const handleSellCart = async () => {
    if (cart.length === 0) return;

    setSelling(true);
    try {
      // Продаємо всі товари з чеку
      const promises = cart.map((item) =>
        api.post('/sales', { product_id: item.product_id, quantity: item.quantity })
      );
      await Promise.all(promises);

      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      toast.success(`Успішно продано ${totalItems} товарів!`);
      setCart([]);
      setShowCart(false);
      await loadData(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка продажу товарів');
    } finally {
      setSelling(false);
    }
  };

  const handleSell = async () => {
    if (!selectedProduct) return;
    if (sellQuantity < 1 || sellQuantity > selectedProduct.quantity) {
      toast.error('Невірна кількість');
      return;
    }

    setSelling(true);
    try {
      await api.post('/sales', { product_id: selectedProduct.id, quantity: sellQuantity });
      toast.success(`Товар "${selectedProduct.name}" успішно продано!`);
      setShowSellModal(false);
      setSelectedProduct(null);
      setSellQuantity(1);
      await loadData(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка продажу товару');
    } finally {
      setSelling(false);
    }
  };

  const handleCancelSale = async (saleId: number) => {
    try {
      const response = await api.delete(`/sales/${saleId}`);
      toast.success('Продаж успішно відмінено');
      await loadData(true);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Помилка відміни продажу';
      toast.error(errorMessage);
    }
  };

  const canCancelSale = (createdAt: string) => {
    try {
      const saleTime = new Date(createdAt);
      const now = new Date();
      const minutesDiff = (now.getTime() - saleTime.getTime()) / (1000 * 60);
      return minutesDiff <= 30 && minutesDiff >= 0;
    } catch {
      return false;
    }
  };

  const filteredProducts = data?.products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query)
    );
  }) || [];

  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(String(item.price || 0)) * item.quantity,
    0
  );
  const cartCommission = cartTotal * 0.12;

  if (loading && !data) {
    return <div className="text-center py-12">Завантаження...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Помилка завантаження даних</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Панель продавця</h1>
        {cart.length > 0 && (
          <button
            onClick={() => setShowCart(!showCart)}
            className="btn btn-primary relative"
          >
            Чек ({cart.length})
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        )}
      </div>

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

      {/* Cart Modal */}
      {showCart && cart.length > 0 && (
        <div className="card bg-blue-50 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Чек ({cart.length} товарів)</h2>
            <button
              onClick={() => setShowCart(false)}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-gray-600">
                    {parseFloat(String(item.price || 0)).toFixed(2)} ₴ × {item.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateCartQuantity(item.product_id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center disabled:opacity-50"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdateCartQuantity(item.product_id, item.quantity + 1)}
                    disabled={item.quantity >= item.maxQuantity}
                    className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center disabled:opacity-50"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleRemoveFromCart(item.product_id)}
                    className="ml-2 text-red-500 hover:text-red-700 text-sm"
                  >
                    Видалити
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Сума:</span>
              <span className="font-semibold text-green-600">{cartTotal.toFixed(2)} ₴</span>
            </div>
            <div className="flex justify-between text-sm text-purple-600 mb-4">
              <span>Комісія (12%):</span>
              <span className="font-semibold">{cartCommission.toFixed(2)} ₴</span>
            </div>
            <button
              onClick={handleSellCart}
              disabled={selling || cart.length === 0}
              className="w-full btn btn-primary disabled:opacity-50"
            >
              {selling ? 'Продаю...' : `Продати все (${cart.reduce((sum, item) => sum + item.quantity, 0)} шт.)`}
            </button>
          </div>
        </div>
      )}

      {/* Products - Full Width */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              {searchQuery ? 'Нічого не знайдено' : 'Немає товарів'}
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm sm:text-base mb-1">{product.name}</div>
                  {product.brand && (
                    <div className="text-xs text-gray-600 mb-2">{product.brand}</div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">
                      В наявності: <span className="font-semibold">{product.quantity}</span>
                    </span>
                    <span className="font-semibold text-green-600 text-sm">
                      {parseFloat(String(product.price || 0)).toFixed(2)} ₴
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => handleSellClick(product)}
                    disabled={product.quantity === 0}
                    className="flex-1 btn btn-primary text-xs sm:text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Продати
                  </button>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.quantity === 0}
                    className="btn bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Додати до чеку"
                  >
                    +
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
