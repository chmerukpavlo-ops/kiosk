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
    type?: string;
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

const CATEGORIES = [
  { id: 'all', label: 'Всі', value: null },
  { id: 'pod', label: 'Pod-системи', value: 'Pod-системи' },
  { id: 'liquid', label: 'Рідини', value: 'Рідини' },
  { id: 'disposable', label: 'Одноразки', value: 'Одноразки' },
];

export function SellerDashboard() {
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selling, setSelling] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [clickedProductId, setClickedProductId] = useState<number | null>(null);
  const CACHE_DURATION = 30000; // 30 секунд кешування

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
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
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddToCart = (product: typeof data!.products[0]) => {
    if (product.quantity === 0) {
      toast.error('Товар відсутній');
      return;
    }

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
        toast.success(`${product.name} додано до кошика`);
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
      toast.success(`${product.name} додано до кошика`);
    }

    // Анімація натискання
    setClickedProductId(product.id);
    setTimeout(() => setClickedProductId(null), 200);
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product_id !== productId));
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
      const promises = cart.map((item) =>
        api.post('/sales', { product_id: item.product_id, quantity: item.quantity })
      );
      await Promise.all(promises);

      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      toast.success(`Успішно продано ${totalItems} товарів!`);
      setCart([]);
      await loadData(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка продажу товарів');
    } finally {
      setSelling(false);
    }
  };

  const handleCancelSale = async (saleId: number) => {
    try {
      await api.delete(`/sales/${saleId}`);
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

  // Фільтрація товарів
  const filteredProducts = data?.products.filter((product) => {
    // Фільтр по категорії
    if (selectedCategory && product.type !== selectedCategory) {
      return false;
    }

    // Фільтр пошуку
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.type?.toLowerCase().includes(query)
      );
    }

    return true;
  }) || [];

  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(String(item.price || 0)) * item.quantity,
    0
  );
  const cartCommission = cartTotal * 0.12;

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { color: 'text-gray-400', bg: 'bg-gray-100', label: 'Немає' };
    if (quantity < 5) return { color: 'text-red-600', bg: 'bg-red-50', label: 'Мало' };
    if (quantity <= 10) return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Обмежено' };
    return { color: 'text-green-600', bg: 'bg-green-50', label: 'В наявності' };
  };

  if (loading && !data) {
    return <div className="text-center py-12">Завантаження...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Помилка завантаження даних</div>;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header з картками */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Панель продавця</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-3 rounded-lg">
            <div className="text-xs opacity-90 mb-1">Наявність</div>
            <div className="text-lg font-bold">{data.cards.total_quantity} шт.</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-3 rounded-lg">
            <div className="text-xs opacity-90 mb-1">Виручка</div>
            <div className="text-lg font-bold">{parseFloat(String(data.cards.revenue_today || 0)).toFixed(2)} ₴</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 rounded-lg">
            <div className="text-xs opacity-90 mb-1">Комісія</div>
            <div className="text-lg font-bold">{parseFloat(String(data.cards.commission_today || 0)).toFixed(2)} ₴</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-3 rounded-lg">
            <div className="text-xs opacity-90 mb-1">Продано</div>
            <div className="text-lg font-bold">{data.recent_sales.length}</div>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Ліва частина - Товари (70%) */}
        <div className="flex-1 flex flex-col overflow-hidden lg:w-[70%]">
          {/* Пошук та категорії */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4 space-y-3">
            <input
              type="text"
              placeholder="🔍 Швидкий пошук товару..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* Категорії - горизонтальний скрол */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category.value
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Сітка товарів */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery || selectedCategory ? 'Нічого не знайдено' : 'Немає товарів'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((item) => item.product_id === product.id);
                  const stockStatus = getStockStatus(product.quantity);
                  const isClicked = clickedProductId === product.id;

                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-lg border-2 border-gray-200 p-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer ${
                        isClicked ? 'scale-95' : 'scale-100'
                      } ${product.quantity === 0 ? 'opacity-60' : ''}`}
                      onClick={() => handleAddToCart(product)}
                    >
                      {/* Назва та бренд */}
                      <div className="mb-2">
                        <div className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
                          {product.name}
                        </div>
                        {product.brand && (
                          <div className="text-xs text-gray-500">{product.brand}</div>
                        )}
                      </div>

                      {/* Ціна - велика та жирна */}
                      <div className="mb-2">
                        <div className="text-xl font-bold text-green-600">
                          {parseFloat(String(product.price || 0)).toFixed(2)} ₴
                        </div>
                      </div>

                      {/* Статус залишків */}
                      <div className="mb-2">
                        <div className={`text-xs px-2 py-1 rounded ${stockStatus.bg} ${stockStatus.color} font-medium inline-block`}>
                          {stockStatus.label}: {product.quantity} шт.
                        </div>
                      </div>

                      {/* Контролер кількості якщо в кошику */}
                      {inCart ? (
                        <div className="flex items-center justify-between bg-blue-50 rounded-lg p-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (inCart.quantity > 1) {
                                handleUpdateCartQuantity(product.id, inCart.quantity - 1);
                              } else {
                                handleRemoveFromCart(product.id);
                              }
                            }}
                            className="w-7 h-7 rounded bg-red-500 text-white flex items-center justify-center font-bold hover:bg-red-600 transition-colors"
                          >
                            −
                          </button>
                          <span className="font-semibold text-sm">{inCart.quantity}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateCartQuantity(product.id, inCart.quantity + 1);
                            }}
                            disabled={inCart.quantity >= product.quantity}
                            className="w-7 h-7 rounded bg-green-500 text-white flex items-center justify-center font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-center text-gray-400 mt-2">
                          {product.quantity > 0 ? 'Натисніть для додавання' : 'Немає в наявності'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Права частина - Кошик (30%) */}
        <div className="flex-shrink-0 bg-white border-t lg:border-l border-gray-200 flex flex-col lg:w-[30%] h-[400px] lg:h-auto">
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <h2 className="text-lg font-bold">Кошик</h2>
            <div className="text-sm opacity-90 mt-1">{cart.length} товарів</div>
          </div>

          {/* Список товарів у кошику */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Кошик порожній
                <br />
                <span className="text-xs">Додайте товари зліва</span>
              </div>
            ) : (
              cart.map((item) => {
                const product = data.products.find((p) => p.id === item.product_id);
                const stockStatus = getStockStatus(product?.quantity || 0);

                return (
                  <div key={item.product_id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="font-medium text-sm mb-1">{item.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      {parseFloat(String(item.price || 0)).toFixed(2)} ₴ × {item.quantity}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${stockStatus.bg} ${stockStatus.color} inline-block mb-2`}>
                      Залишок: {product?.quantity || 0} шт.
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              handleUpdateCartQuantity(item.product_id, item.quantity - 1);
                            } else {
                              handleRemoveFromCart(item.product_id);
                            }
                          }}
                          className="w-8 h-8 rounded bg-red-500 text-white flex items-center justify-center font-bold hover:bg-red-600 transition-colors text-sm"
                        >
                          −
                        </button>
                        <span className="font-semibold w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateCartQuantity(item.product_id, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          className="w-8 h-8 rounded bg-green-500 text-white flex items-center justify-center font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.product_id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Видалити
                      </button>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-green-600">
                      {(parseFloat(String(item.price || 0)) * item.quantity).toFixed(2)} ₴
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Підсумок та кнопка оплати */}
          {cart.length > 0 && (
            <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Сума:</span>
                  <span className="font-semibold text-green-600">{cartTotal.toFixed(2)} ₴</span>
                </div>
                <div className="flex justify-between text-sm text-purple-600">
                  <span>Комісія (12%):</span>
                  <span className="font-semibold">{cartCommission.toFixed(2)} ₴</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                  <span>Всього:</span>
                  <span className="text-green-600">{cartTotal.toFixed(2)} ₴</span>
                </div>
              </div>
              <button
                onClick={handleSellCart}
                disabled={selling || cart.length === 0}
                className="w-full btn btn-primary py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selling ? 'Продаю...' : `Оплатити (${cart.reduce((sum, item) => sum + item.quantity, 0)} шт.)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
