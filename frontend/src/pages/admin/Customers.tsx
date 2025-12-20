import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';
import { formatErrorMessage } from '../../lib/errorHandler';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  total_purchases: number;
  total_visits: number;
  last_visit?: string;
  loyalty_points: number;
  created_at: string;
  sales?: any[];
  stats?: {
    total_sales: number;
    total_spent: number;
    unique_visits: number;
    first_purchase?: string;
    last_purchase?: string;
  };
}

export function Customers(): React.JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [sortBy]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy) params.append('sort', sortBy);

      const response = await api.get(`/customers?${params.toString()}`);
      setCustomers(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Failed to load customers:', error);
      toast.error(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        loadCustomers();
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortBy]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name'),
      phone: formData.get('phone') || null,
      email: formData.get('email') || null,
      notes: formData.get('notes') || null,
    };

    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, data);
        toast.success('Клієнта оновлено');
      } else {
        await api.post('/customers', data);
        toast.success('Клієнта додано');
      }
      setShowModal(false);
      setEditingCustomer(null);
      loadCustomers();
    } catch (error: any) {
      toast.error(formatErrorMessage(error));
    }
  };

  const handleDelete = async (id: number) => {
    if (!id || isNaN(id)) {
      toast.error('Невірний ID клієнта');
      return;
    }
    
    const customer = customers.find(c => c.id === id);
    if (customer) {
      setDeleteConfirm({ id, name: customer.name });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.delete(`/customers/${deleteConfirm.id}`);
      toast.success('Клієнта видалено');
      setDeleteConfirm(null);
      loadCustomers();
      if (selectedCustomer?.id === deleteConfirm.id) {
        setSelectedCustomer(null);
      }
    } catch (error: any) {
      toast.error(formatErrorMessage(error));
      setDeleteConfirm(null);
    }
  };

  const loadCustomerDetails = async (id: number) => {
    if (!id || isNaN(id)) {
      toast.error('Невірний ID клієнта');
      return;
    }
    try {
      const response = await api.get(`/customers/${id}`);
      setSelectedCustomer(response.data);
    } catch (error: any) {
      console.error('Failed to load customer details:', error);
      toast.error(formatErrorMessage(error));
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Завантаження...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Клієнти</h1>
        <button
          onClick={() => {
            setEditingCustomer(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Додати клієнта
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Пошук по імені, телефону, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input"
          >
            <option value="name">Сортувати по імені</option>
            <option value="purchases">Сортувати по покупкам</option>
            <option value="visits">Сортувати по візитам</option>
            <option value="points">Сортувати по балах</option>
          </select>
        </div>
      </div>

      {/* Customers List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Ім'я</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Покупки</th>
                <th>Візити</th>
                <th>Бали</th>
                <th>Останній візит</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    {searchQuery ? 'Клієнтів не знайдено' : 'Немає клієнтів'}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => loadCustomerDetails(customer.id)}
                  >
                    <td className="font-medium">{customer.name}</td>
                    <td>{customer.phone || '—'}</td>
                    <td>{customer.email || '—'}</td>
                    <td className="font-semibold text-green-600">
                      {parseFloat(String(customer.total_purchases || 0)).toFixed(2)} ₴
                    </td>
                    <td>{customer.total_visits || 0}</td>
                    <td>
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-semibold">
                        {customer.loyalty_points || 0}
                      </span>
                    </td>
                    <td>
                      {customer.last_visit
                        ? format(new Date(customer.last_visit), 'dd.MM.yyyy', { locale: uk })
                        : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setShowModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
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
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">{selectedCustomer.name}</h2>
              <p className="text-sm text-gray-500">
                {selectedCustomer.phone && `📞 ${selectedCustomer.phone}`}
                {selectedCustomer.email && ` • ✉️ ${selectedCustomer.email}`}
              </p>
            </div>
            <button
              onClick={() => setSelectedCustomer(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {selectedCustomer.notes && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700">{selectedCustomer.notes}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-green-50 rounded">
              <div className="text-sm text-gray-600">Всього покупок</div>
              <div className="text-xl font-bold text-green-600">
                {parseFloat(String(selectedCustomer.total_purchases || 0)).toFixed(2)} ₴
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-600">Візитів</div>
              <div className="text-xl font-bold text-blue-600">
                {selectedCustomer.total_visits || 0}
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded">
              <div className="text-sm text-gray-600">Балів лояльності</div>
              <div className="text-xl font-bold text-purple-600">
                {selectedCustomer.loyalty_points || 0}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Останній візит</div>
              <div className="text-sm font-semibold">
                {selectedCustomer.last_visit
                  ? format(new Date(selectedCustomer.last_visit), 'dd.MM.yyyy', { locale: uk })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Purchase History */}
          {selectedCustomer.sales && selectedCustomer.sales.length > 0 ? (
            <div>
              <h3 className="text-md font-semibold mb-3">Історія покупок</h3>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Товар</th>
                      <th>Продавець</th>
                      <th>Ларьок</th>
                      <th>Сума</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomer.sales.map((sale: any) => (
                      <tr key={sale.id}>
                        <td>
                          {format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                        </td>
                        <td>{sale.product_name || '—'}</td>
                        <td>{sale.seller_name || '—'}</td>
                        <td>{sale.kiosk_name || '—'}</td>
                        <td className="font-semibold">
                          {parseFloat(String(sale.price || 0)).toFixed(2)} ₴
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Немає історії покупок
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingCustomer ? 'Редагувати клієнта' : 'Додати клієнта'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ім'я *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingCustomer?.name || ''}
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Телефон</label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingCustomer?.phone || ''}
                  className="input"
                  placeholder="+380XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingCustomer?.email || ''}
                  className="input"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Примітки</label>
                <textarea
                  name="notes"
                  defaultValue={editingCustomer?.notes || ''}
                  className="input"
                  rows={3}
                  placeholder="Додаткові примітки про клієнта..."
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCustomer(null);
                  }}
                  className="btn btn-secondary"
                >
                  Скасувати
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Зберегти' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Видалити клієнта?"
        message={
          deleteConfirm ? (
            <>
              <p className="mb-2">Ви впевнені, що хочете видалити клієнта:</p>
              <p className="font-semibold text-gray-900">{deleteConfirm.name}</p>
              <p className="mt-2 text-sm text-gray-600">
                Історія покупок залишиться, але без прив'язки до клієнта.
              </p>
            </>
          ) : ''
        }
        confirmText="Видалити"
        cancelText="Скасувати"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

