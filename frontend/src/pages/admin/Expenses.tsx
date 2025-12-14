import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';

interface Expense {
  id: number;
  kiosk_id?: number;
  kiosk_name?: string;
  category: 'rent' | 'purchase' | 'other';
  description?: string;
  amount: number;
  date: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

interface ExpenseStats {
  total: number;
  by_category: Array<{
    category: string;
    total_expenses: number;
    category_amount: number;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Оренда',
  purchase: 'Закупівля',
  other: 'Інше',
};

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    kiosk_id: '',
  });

  useEffect(() => {
    loadKiosks();
    loadExpenses();
    loadStats();
  }, [filters]);

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data || []);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.category) params.append('category', filters.category);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/expenses?${params.toString()}`);
      setExpenses(response.data || []);
    } catch (error: any) {
      console.error('Failed to load expenses:', error);
      toast.error(error.response?.data?.error || 'Помилка завантаження витрат');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.category) params.append('category', filters.category);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));
      params.append('period', 'month');

      const response = await api.get(`/expenses/stats?${params.toString()}`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цю витрату?')) return;

    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Витрату успішно видалено!');
      loadExpenses();
      loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка видалення витрати');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      kiosk_id: formData.get('kiosk_id') ? parseInt(formData.get('kiosk_id') as string) : null,
      category: formData.get('category'),
      description: formData.get('description'),
      amount: parseFloat(formData.get('amount') as string),
      date: formData.get('date'),
    };

    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, data);
        toast.success('Витрату успішно оновлено!');
      } else {
        await api.post('/expenses', data);
        toast.success('Витрату успішно додано!');
      }
      setShowModal(false);
      setEditingExpense(null);
      loadExpenses();
      loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка збереження витрати');
    }
  };

  const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(String(exp.amount || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Витрати</h1>
        <button
          onClick={() => {
            setEditingExpense(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Додати витрату
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Дата від</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Дата до</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Категорія</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input"
            >
              <option value="">Всі категорії</option>
              <option value="rent">Оренда</option>
              <option value="purchase">Закупівля</option>
              <option value="other">Інше</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ларьок</label>
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
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="text-sm opacity-90 mb-1">Загальні витрати</div>
            <div className="text-2xl font-bold">{stats.total.toFixed(2)} ₴</div>
          </div>
          {stats.by_category.map((cat) => (
            <div key={cat.category} className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <div className="text-sm opacity-90 mb-1">{CATEGORY_LABELS[cat.category] || cat.category}</div>
              <div className="text-2xl font-bold">{parseFloat(String(cat.category_amount || 0)).toFixed(2)} ₴</div>
            </div>
          ))}
        </div>
      )}

      {/* Expenses Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">Завантаження...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Категорія</th>
                  <th>Опис</th>
                  <th>Ларьок</th>
                  <th>Сума</th>
                  <th>Додав</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      Немає витрат
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{format(new Date(expense.date), 'dd.MM.yyyy', { locale: uk })}</td>
                      <td>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </span>
                      </td>
                      <td>{expense.description || '-'}</td>
                      <td>{expense.kiosk_name || 'Всі ларьки'}</td>
                      <td className="font-semibold text-red-600">
                        {parseFloat(String(expense.amount || 0)).toFixed(2)} ₴
                      </td>
                      <td className="text-sm text-gray-600">{expense.created_by_name || '-'}</td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingExpense(expense);
                              setShowModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-700 text-sm"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id)}
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

      {/* Add/Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingExpense ? 'Редагувати витрату' : 'Додати витрату'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Категорія *</label>
                <select
                  name="category"
                  defaultValue={editingExpense?.category || ''}
                  className="input"
                  required
                >
                  <option value="">Виберіть категорію</option>
                  <option value="rent">Оренда</option>
                  <option value="purchase">Закупівля</option>
                  <option value="other">Інше</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Опис</label>
                <textarea
                  name="description"
                  defaultValue={editingExpense?.description || ''}
                  className="input"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Сума *</label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  defaultValue={editingExpense?.amount ? parseFloat(String(editingExpense.amount)) : ''}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дата *</label>
                <input
                  type="date"
                  name="date"
                  defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ларьок</label>
                <select
                  name="kiosk_id"
                  defaultValue={editingExpense?.kiosk_id ? String(editingExpense.kiosk_id) : ''}
                  className="input"
                >
                  <option value="">Всі ларьки</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={kiosk.id}>
                      {kiosk.name}
                    </option>
                  ))}
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
                    setEditingExpense(null);
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

