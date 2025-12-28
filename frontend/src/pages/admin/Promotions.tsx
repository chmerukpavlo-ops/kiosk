import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Promotion {
  id: number;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'bundle';
  discount_percent?: number;
  discount_amount?: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  applicable_to: 'all' | 'category' | 'brand' | 'products';
  category_filter?: string;
  brand_filter?: string;
  product_ids?: number[];
  created_by_name?: string;
  product_count?: number;
}

export function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);

  useEffect(() => {
    loadPromotions();
    loadProducts();
    loadKiosks();
  }, []);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/promotions');
      setPromotions(response.data || []);
    } catch (error: any) {
      console.error('Failed to load promotions:', error);
      toast.error('Помилка завантаження акцій');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data || []);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get('name'),
      description: formData.get('description') || null,
      type: formData.get('type'),
      discount_percent: formData.get('discount_percent') 
        ? parseFloat(formData.get('discount_percent') as string) 
        : null,
      discount_amount: formData.get('discount_amount')
        ? parseFloat(formData.get('discount_amount') as string)
        : null,
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date') || null,
      is_active: formData.get('is_active') === 'on',
      min_purchase_amount: formData.get('min_purchase_amount')
        ? parseFloat(formData.get('min_purchase_amount') as string)
        : null,
      max_discount_amount: formData.get('max_discount_amount')
        ? parseFloat(formData.get('max_discount_amount') as string)
        : null,
      applicable_to: formData.get('applicable_to') || 'all',
      category_filter: formData.get('category_filter') || null,
      brand_filter: formData.get('brand_filter') || null,
      product_ids: formData.get('product_ids')
        ? (formData.get('product_ids') as string).split(',').map(id => parseInt(id.trim())).filter(Boolean)
        : null,
    };

    try {
      if (editingPromotion) {
        await api.put(`/promotions/${editingPromotion.id}`, data);
        toast.success('Акцію оновлено');
      } else {
        await api.post('/promotions', data);
        toast.success('Акцію створено');
      }
      setShowModal(false);
      setEditingPromotion(null);
      loadPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка збереження акції');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цю акцію?')) return;

    try {
      await api.delete(`/promotions/${id}`);
      toast.success('Акцію видалено');
      loadPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка видалення акції');
    }
  };

  const handleToggleActive = async (promotion: Promotion) => {
    try {
      await api.put(`/promotions/${promotion.id}`, {
        is_active: !promotion.is_active,
      });
      toast.success(`Акцію ${!promotion.is_active ? 'активовано' : 'деактивовано'}`);
      loadPromotions();
    } catch (error: any) {
      toast.error('Помилка оновлення акції');
    }
  };

  const getPromotionStatus = (promotion: Promotion) => {
    if (!promotion.is_active) return { label: 'Неактивна', color: 'text-gray-500' };
    
    const today = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

    if (today < startDate) {
      return { label: 'Очікується', color: 'text-blue-500' };
    }
    if (endDate && today > endDate) {
      return { label: 'Завершена', color: 'text-red-500' };
    }
    return { label: 'Активна', color: 'text-green-500' };
  };

  const getDiscountDisplay = (promotion: Promotion) => {
    if (promotion.type === 'percentage' && promotion.discount_percent) {
      return `-${promotion.discount_percent}%`;
    }
    if (promotion.type === 'fixed' && promotion.discount_amount) {
      return `-${promotion.discount_amount} ₴`;
    }
    return promotion.type;
  };

  if (loading) {
    return <div className="text-center py-12">Завантаження...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Акції та знижки</h1>
        <button
          onClick={() => {
            setEditingPromotion(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Створити акцію
        </button>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promotions.map((promotion) => {
          const status = getPromotionStatus(promotion);
          
          return (
            <div
              key={promotion.id}
              className="card border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {promotion.name}
                  </h3>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {getDiscountDisplay(promotion)}
                  </div>
                </div>
                <span className={`text-sm font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {promotion.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {promotion.description}
                </p>
              )}

              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <div>
                  <span className="font-medium">Період:</span>{' '}
                  {format(new Date(promotion.start_date), 'dd.MM.yyyy', { locale: uk })}
                  {promotion.end_date && (
                    <> - {format(new Date(promotion.end_date), 'dd.MM.yyyy', { locale: uk })}</>
                  )}
                </div>
                <div>
                  <span className="font-medium">Застосовується до:</span>{' '}
                  {promotion.applicable_to === 'all' && 'Всі товари'}
                  {promotion.applicable_to === 'category' && `Категорія: ${promotion.category_filter}`}
                  {promotion.applicable_to === 'brand' && `Бренд: ${promotion.brand_filter}`}
                  {promotion.applicable_to === 'products' && `${promotion.product_count || 0} товарів`}
                </div>
                {promotion.min_purchase_amount && (
                  <div>
                    <span className="font-medium">Мін. сума покупки:</span>{' '}
                    {promotion.min_purchase_amount.toFixed(2)} ₴
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleToggleActive(promotion)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                    promotion.is_active
                      ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                      : 'bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800'
                  }`}
                >
                  {promotion.is_active ? 'Деактивувати' : 'Активувати'}
                </button>
                <button
                  onClick={() => {
                    setEditingPromotion(promotion);
                    setShowModal(true);
                  }}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Редагувати
                </button>
                <button
                  onClick={() => handleDelete(promotion.id)}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                >
                  Видалити
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {promotions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🏷️</div>
          <p>Немає створених акцій</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingPromotion ? 'Редагувати акцію' : 'Створити акцію'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Назва акції *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingPromotion?.name}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Опис</label>
                <textarea
                  name="description"
                  defaultValue={editingPromotion?.description || ''}
                  className="input"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Тип акції *</label>
                  <select
                    name="type"
                    defaultValue={editingPromotion?.type || 'percentage'}
                    className="input"
                    required
                  >
                    <option value="percentage">Відсоток знижки</option>
                    <option value="fixed">Фіксована сума</option>
                    <option value="buy_x_get_y">Купи X отримай Y</option>
                    <option value="bundle">Набір товарів</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Застосовується до *</label>
                  <select
                    name="applicable_to"
                    defaultValue={editingPromotion?.applicable_to || 'all'}
                    className="input"
                    required
                  >
                    <option value="all">Всі товари</option>
                    <option value="category">Категорія</option>
                    <option value="brand">Бренд</option>
                    <option value="products">Конкретні товари</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Відсоток знижки (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="discount_percent"
                    defaultValue={editingPromotion?.discount_percent || ''}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Фіксована сума знижки (₴)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="discount_amount"
                    defaultValue={editingPromotion?.discount_amount || ''}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата початку *</label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={editingPromotion?.start_date || ''}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Дата закінчення</label>
                  <input
                    type="date"
                    name="end_date"
                    defaultValue={editingPromotion?.end_date || ''}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Мінімальна сума покупки (₴)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="min_purchase_amount"
                    defaultValue={editingPromotion?.min_purchase_amount || ''}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Максимальна сума знижки (₴)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="max_discount_amount"
                    defaultValue={editingPromotion?.max_discount_amount || ''}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  defaultChecked={editingPromotion?.is_active !== false}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                  Активна
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPromotion(null);
                    setShowModal(false);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingPromotion ? 'Оновити' : 'Створити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

