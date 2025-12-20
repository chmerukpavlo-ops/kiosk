import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';
import { Receipt } from '../../components/Receipt';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { useAuth } from '../../context/AuthContext';

interface SellerDashboardData {
  cards: {
    total_products: number;
    total_quantity: number;
    revenue_today: number | string;
  };
  products: Array<{
    id: number;
    name: string;
    brand?: string;
    type?: string;
    price: number | string;
    quantity: number;
    discount_percent?: number;
    active_discount_percent?: number;
    final_price?: number;
  }>;
  recent_sales: Array<{
    id: number;
    product_name: string;
    price: number | string;
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

type Product = SellerDashboardData['products'][0];

const CATEGORIES = [
  { id: 'all', label: 'Всі', value: null },
  { id: 'pod', label: 'Pod-системи', value: 'Pod-системи' },
  { id: 'liquid', label: 'Рідини', value: 'Рідини' },
  { id: 'disposable', label: 'Одноразки', value: 'Одноразки' },
];

export function SellerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selling, setSelling] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [clickedProductId, setClickedProductId] = useState<number | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false); // <lg
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    items: Array<{ name: string; quantity: number; price: number; total: number }>;
    total: number;
    saleIds: number[];
    paymentMethod?: 'cash' | 'card';
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const CACHE_DURATION = 30000; // 30 секунд кешування

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)'); // Tailwind lg breakpoint
    const apply = () => {
      const mobile = mq.matches;
      setIsMobileLayout(mobile);
      // default collapsed stats on mobile
      setIsStatsCollapsed(mobile);
      // close cart sheet when switching to desktop
      if (!mobile) setIsCartOpen(false);
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // Close cart sheet when other modals open
  useEffect(() => {
    if (showPaymentModal || showReceipt) setIsCartOpen(false);
  }, [showPaymentModal, showReceipt]);

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

  const handleAddToCart = (product: Product) => {
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
      const finalPrice = (product.final_price && !isNaN(product.final_price)) 
        ? product.final_price 
        : parseFloat(String(product.price || 0));
      
      if (isNaN(finalPrice) || finalPrice < 0) {
        toast.error('Невірна ціна товару');
        return;
      }
      
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          price: finalPrice,
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
    setShowPaymentModal(true);
  };

  const confirmSale = async () => {
    if (cart.length === 0) return;

    setSelling(true);
    setShowPaymentModal(false);
    try {
      const salePromises = cart.map((item) =>
        api.post('/sales', { 
          product_id: item.product_id, 
          quantity: item.quantity,
          customer_id: selectedCustomerId || undefined
        })
      );
      const saleResults = await Promise.all(salePromises);
      
      // Prepare receipt data
      const receiptItems = cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(String(item.price || 0)),
        total: parseFloat(String(item.price || 0)) * item.quantity,
      }));
      
      const receiptTotal = cart.reduce(
        (sum, item) => sum + parseFloat(String(item.price || 0)) * item.quantity,
        0
      );
      
      const saleIds = saleResults.map((res: any) => res.data.id).filter(Boolean);
      
      setReceiptData({
        items: receiptItems,
        total: receiptTotal,
        saleIds,
        paymentMethod,
      });
      
      setShowReceipt(true);
      setCart([]);
      setSelectedCustomerId(null); // Reset customer after sale
      await loadData(true);
      toast.success(`Успішно продано ${receiptItems.reduce((sum, item) => sum + item.quantity, 0)} товарів!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка продажу товарів');
    } finally {
      setSelling(false);
    }
  };

  // Обробка сканування штрих-коду
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!barcode || !data) return;

    // Шукаємо товар за ID (якщо штрих-код містить ID)
    const productId = parseInt(barcode);
    if (!isNaN(productId)) {
      const product = data.products.find(p => p.id === productId);
      if (product && product.quantity > 0) {
        // Додаємо до кошика
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
          }
        } else {
          const finalPrice = (product.final_price && !isNaN(product.final_price)) 
            ? product.final_price 
            : parseFloat(String(product.price || 0));
          
          if (!isNaN(finalPrice) && finalPrice >= 0) {
            setCart([
              ...cart,
              {
                product_id: product.id,
                name: product.name,
                price: finalPrice,
                quantity: 1,
                maxQuantity: product.quantity,
              },
            ]);
          }
        }
        setSearchQuery('');
        setShowBarcodeScanner(false);
        toast.success(`Знайдено: ${product.name}`);
        return;
      }
    }

    // Шукаємо за назвою, брендом або типом
    const query = barcode.toLowerCase();
    const foundProduct = data.products.find(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        String(p.id) === barcode
    );

    if (foundProduct && foundProduct.quantity > 0) {
      // Додаємо до кошика
      const existingItem = cart.find((item) => item.product_id === foundProduct.id);
      if (existingItem) {
        if (existingItem.quantity < foundProduct.quantity) {
          setCart(
            cart.map((item) =>
              item.product_id === foundProduct.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          );
        }
      } else {
        const finalPrice = (foundProduct.final_price && !isNaN(foundProduct.final_price)) 
          ? foundProduct.final_price 
          : parseFloat(String(foundProduct.price || 0));
        
        if (!isNaN(finalPrice) && finalPrice >= 0) {
          setCart([
            ...cart,
            {
              product_id: foundProduct.id,
              name: foundProduct.name,
              price: finalPrice,
              quantity: 1,
              maxQuantity: foundProduct.quantity,
            },
          ]);
        }
      }
      setSearchQuery('');
      setShowBarcodeScanner(false);
      toast.success(`Знайдено: ${foundProduct.name}`);
    } else {
      setSearchQuery(barcode);
      setShowBarcodeScanner(false);
      toast.info('Товар не знайдено, показано результати пошуку');
    }
  }, [data, cart]);

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
        product.type?.toLowerCase().includes(query) ||
        String(product.id) === searchQuery
      );
    }

    return true;
  }) || [];

  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(String(item.price || 0)) * item.quantity,
    0
  );

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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Панель продавця</h1>
            <div className="text-xs text-gray-500 mt-1 truncate">
              {user?.full_name || 'Продавець'}
            </div>
          </div>

          {/* Mobile controls */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStatsCollapsed((v) => !v)}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
            >
              {isStatsCollapsed ? 'Статистика' : 'Згорнути'}
            </button>
          </div>
        </div>

        {/* Compact stats (mobile collapsed) */}
        {isMobileLayout && isStatsCollapsed ? (
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm whitespace-nowrap">
              <span className="font-semibold">{data.cards.total_quantity}</span> шт.
            </div>
            <div className="px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm whitespace-nowrap">
              <span className="font-semibold">
                {parseFloat(String(data.cards.revenue_today || 0)).toFixed(2)}
              </span>{' '}
              ₴
            </div>
            <div className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm whitespace-nowrap">
              <span className="font-semibold">{data.recent_sales.length}</span> продажів
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-3 rounded-lg">
              <div className="text-xs opacity-90 mb-1">Наявність</div>
              <div className="text-lg font-bold">{data.cards.total_quantity} шт.</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-3 rounded-lg">
              <div className="text-xs opacity-90 mb-1">Виручка</div>
              <div className="text-lg font-bold">
                {parseFloat(String(data.cards.revenue_today || 0)).toFixed(2)} ₴
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-3 rounded-lg">
              <div className="text-xs opacity-90 mb-1">Продано</div>
              <div className="text-lg font-bold">{data.recent_sales.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Ліва частина - Товари (70%) */}
        <div className="flex-1 flex flex-col overflow-hidden lg:w-[70%] min-h-0">
          {/* Пошук та категорії */}
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex gap-2">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="🔍 Швидкий пошук товару..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter для швидкого додавання першого результату
                  if (e.key === 'Enter' && filteredProducts.length > 0 && filteredProducts[0].quantity > 0) {
                    handleAddToCart(filteredProducts[0]);
                    setSearchQuery('');
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
              <button
                onClick={() => setShowBarcodeScanner(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                title="Сканувати штрих-код"
              >
                📷
              </button>
            </div>
            
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
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0 pb-28 lg:pb-8">
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
                          {product.final_price && !isNaN(parseFloat(String(product.final_price))) && parseFloat(String(product.final_price)) < parseFloat(String(product.price || 0)) ? (
                            <div>
                              <div className="text-gray-400 line-through text-sm">
                                {parseFloat(String(product.price || 0)).toFixed(2)} ₴
                              </div>
                              <div className="text-red-600 font-semibold">
                                {parseFloat(String(product.final_price)).toFixed(2)} ₴
                              </div>
                              {(product.active_discount_percent || product.discount_percent) && (
                                <span className="text-xs text-red-600 font-semibold">
                                  -{parseFloat(String(product.active_discount_percent || product.discount_percent || 0)).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span>{parseFloat(String(product.price || 0)).toFixed(2)} ₴</span>
                          )}
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
        <div className="hidden lg:flex flex-shrink-0 bg-white border-t lg:border-l border-gray-200 flex-col lg:w-[30%] h-[40vh] sm:h-[360px] lg:h-auto min-h-0">
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <h2 className="text-lg font-bold">Кошик</h2>
            <div className="text-sm opacity-90 mt-1">{cart.length} товарів</div>
          </div>

          {/* Customer Selection */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <label className="block text-xs font-medium text-gray-700 mb-1">Клієнт (опціонально)</label>
            <div className="flex gap-2">
              <select
                value={selectedCustomerId || ''}
                onChange={(e) => setSelectedCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 input text-sm py-1.5"
              >
                <option value="">Без клієнта</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowCustomerSelect(true)}
                className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
                title="Швидкий пошук клієнта"
              >
                🔍
              </button>
            </div>
            {selectedCustomerId && (
              <div className="mt-2 text-xs text-gray-600">
                {(() => {
                  const customer = customers.find(c => c.id === selectedCustomerId);
                  return customer ? (
                    <>
                      <span className="font-medium">{customer.name}</span>
                      {customer.loyalty_points > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          {customer.loyalty_points} балів
                        </span>
                      )}
                    </>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Список товарів у кошику */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
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
                <div className="flex justify-between text-base font-bold pt-2">
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

      {/* Mobile floating cart button */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className={`w-full rounded-xl px-4 py-3 shadow-lg border flex items-center justify-between ${
            cart.length > 0
              ? 'bg-white border-gray-200'
              : 'bg-gray-100 border-gray-200'
          }`}
        >
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">Кошик</div>
            <div className="text-xs text-gray-500">
              {cart.length === 0 ? 'Порожній' : `${cart.reduce((s, i) => s + i.quantity, 0)} шт. • ${cart.length} позицій`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-green-600">{cartTotal.toFixed(2)} ₴</div>
            <div className="text-xs text-gray-500">Відкрити</div>
          </div>
        </button>
      </div>

      {/* Mobile cart bottom sheet */}
      {isCartOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold">Кошик</div>
                  <div className="text-xs text-gray-500">{cart.length} позицій</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium"
                >
                  Закрити
                </button>
              </div>
              
              {/* Customer Selection for Mobile */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Клієнт (опціонально)</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCustomerId || ''}
                    onChange={(e) => setSelectedCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                    className="flex-1 input text-sm py-1.5"
                  >
                    <option value="">Без клієнта</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedCustomerId && (
                  <div className="mt-2 text-xs text-gray-600">
                    {(() => {
                      const customer = customers.find(c => c.id === selectedCustomerId);
                      return customer ? (
                        <>
                          <span className="font-medium">{customer.name}</span>
                          {customer.loyalty_points > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              {customer.loyalty_points} балів
                            </span>
                          )}
                        </>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  Кошик порожній
                  <br />
                  <span className="text-xs">Додайте товари зі списку</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="font-medium text-sm mb-1">{item.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      {parseFloat(String(item.price || 0)).toFixed(2)} ₴ × {item.quantity}
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
                ))
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-white space-y-3">
              <div className="flex justify-between text-base font-bold">
                <span>Всього:</span>
                <span className="text-green-600">{cartTotal.toFixed(2)} ₴</span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  handleSellCart();
                }}
                disabled={selling || cart.length === 0}
                className="w-full btn btn-primary py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selling ? 'Продаю...' : `Оплатити (${cart.reduce((sum, item) => sum + item.quantity, 0)} шт.)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Виберіть спосіб оплати</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')}
                    className="mr-3 h-5 w-5 text-primary-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-lg">💵 Готівка</div>
                    <div className="text-sm text-gray-600">Оплата готівкою</div>
                  </div>
                </label>
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')}
                    className="mr-3 h-5 w-5 text-primary-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-lg">💳 Картка</div>
                    <div className="text-sm text-gray-600">Оплата банківською карткою</div>
                  </div>
                </label>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-lg font-bold">
                  <span>До сплати:</span>
                  <span className="text-green-600">{cartTotal.toFixed(2)} ₴</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button
                  onClick={confirmSale}
                  disabled={selling}
                  className="btn btn-primary flex-1"
                >
                  {selling ? 'Продаю...' : 'Підтвердити'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full my-8">
            <Receipt
              items={receiptData.items}
              total={receiptData.total}
              saleIds={receiptData.saleIds}
              saleId={receiptData.saleIds[0]}
              sellerName={user?.full_name}
              kioskName="Кіоск"
              paymentMethod={receiptData.paymentMethod || 'cash'}
              onClose={() => {
                setShowReceipt(false);
                setReceiptData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onScan={handleBarcodeScan}
        onClose={() => setShowBarcodeScanner(false)}
      />
    </div>
  );
}
