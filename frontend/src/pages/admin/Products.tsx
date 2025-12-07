import { useEffect, useState } from 'react';
import api from '../../lib/api';

interface Product {
  id: number;
  name: string;
  brand?: string;
  type?: string;
  price: number | string; // Може бути рядком з БД
  quantity: number;
  kiosk_id: number;
  kiosk_name?: string;
  status: string;
}

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    brand: '',
    type: '',
    kiosk_id: '',
    status: '',
  });

  useEffect(() => {
    loadKiosks();
    loadProducts();
  }, [filters]);

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.type) params.append('type', filters.type);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/products?${params.toString()}`);
      setProducts(response.data || []);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      setProducts([]);
      if (error.response?.status === 403 || error.response?.status === 401) {
        alert('Немає доступу до цієї сторінки');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цей товар?')) return;

    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (error) {
      alert('Помилка видалення товару');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      brand: formData.get('brand'),
      type: formData.get('type'),
      price: parseFloat(formData.get('price') as string),
      quantity: parseInt(formData.get('quantity') as string),
      kiosk_id: parseInt(formData.get('kiosk_id') as string),
      status: formData.get('status'),
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, data);
      } else {
        await api.post('/products', data);
      }
      setShowModal(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка збереження товару');
    }
  };

  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))];
  const types = [...new Set(products.map((p) => p.type).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Товари</h1>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Додати товар
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Пошук..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input"
          />
          <select
            value={filters.brand}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
            className="input"
          >
            <option value="">Всі бренди</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input"
          >
            <option value="">Всі типи</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={filters.kiosk_id}
            onChange={(e) => setFilters({ ...filters, kiosk_id: e.target.value })}
            className="input"
          >
            <option value="">Всі ларьки</option>
            {kiosks.map((kiosk) => (
              <option key={kiosk.id} value={String(kiosk.id)}>
                {kiosk.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="">Всі статуси</option>
            <option value="available">В наявності</option>
            <option value="out_of_stock">Немає в наявності</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">Завантаження...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Бренд</th>
                  <th>Тип</th>
                  <th>Ларьок</th>
                  <th>Кількість</th>
                  <th>Ціна</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      Немає товарів
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                    <td className="font-medium">{product.name}</td>
                    <td>{product.brand || '-'}</td>
                    <td>{product.type || '-'}</td>
                    <td>{product.kiosk_name || '-'}</td>
                    <td>{product.quantity}</td>
                    <td className="font-semibold">{parseFloat(String(product.price || 0)).toFixed(2)} ₴</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          product.status === 'available'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {product.status === 'available' ? 'В наявності' : 'Немає'}
                      </span>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-700 text-sm"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Видалити
                        </button>
                      </div>
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingProduct ? 'Редагувати товар' : 'Додати товар'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Назва *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingProduct?.name}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Бренд</label>
                <input
                  type="text"
                  name="brand"
                  defaultValue={editingProduct?.brand}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Тип</label>
                <input
                  type="text"
                  name="type"
                  defaultValue={editingProduct?.type}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ціна *</label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  defaultValue={editingProduct?.price ? parseFloat(String(editingProduct.price)) : ''}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Кількість *</label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={editingProduct?.quantity || 0}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ларьок *</label>
                <select name="kiosk_id" defaultValue={editingProduct?.kiosk_id ? String(editingProduct.kiosk_id) : ''} className="input" required>
                  <option value="">Виберіть ларьок</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={kiosk.id}>
                      {kiosk.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Статус</label>
                <select name="status" defaultValue={editingProduct?.status || 'available'} className="input">
                  <option value="available">В наявності</option>
                  <option value="out_of_stock">Немає в наявності</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="btn btn-primary flex-1">
                  Зберегти
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

