import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Expense {
  id: number;
  kiosk_id?: number;
  kiosk_name?: string;
  category: 'rent' | 'purchase' | 'utilities' | 'advertising' | 'salary' | 'other';
  description?: string;
  amount: number;
  date: string;
  status?: 'paid' | 'planned' | 'cancelled';
  planned_for?: string | null;
  paid_at?: string | null;
  recurrence?: 'none' | 'monthly' | string;
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
  comparison?: {
    previous_total: number;
    difference: number;
    percent_change: number;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Оренда',
  purchase: 'Закупівля',
  utilities: 'Комунальні',
  advertising: 'Реклама',
  salary: 'Зарплата',
  other: 'Інше',
};

// Color scheme for categories - matching cards and badges
const getCategoryColors = (category: string) => {
  switch (category) {
    case 'rent':
      return {
        card: 'bg-gradient-to-br from-blue-500 to-blue-600',
        badge: 'bg-blue-100 text-blue-700',
        badgeDark: 'bg-blue-50 text-blue-800 border border-blue-200',
      };
    case 'purchase':
      return {
        card: 'bg-gradient-to-br from-green-500 to-green-600',
        badge: 'bg-green-100 text-green-700',
        badgeDark: 'bg-green-50 text-green-800 border border-green-200',
      };
    case 'utilities':
      return {
        card: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
        badge: 'bg-cyan-100 text-cyan-700',
        badgeDark: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
      };
    case 'advertising':
      return {
        card: 'bg-gradient-to-br from-purple-500 to-purple-600',
        badge: 'bg-purple-100 text-purple-700',
        badgeDark: 'bg-purple-50 text-purple-800 border border-purple-200',
      };
    case 'salary':
      return {
        card: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
        badge: 'bg-indigo-100 text-indigo-700',
        badgeDark: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
      };
    case 'other':
      return {
        card: 'bg-gradient-to-br from-amber-500 to-amber-600',
        badge: 'bg-amber-100 text-amber-700',
        badgeDark: 'bg-amber-50 text-amber-800 border border-amber-200',
      };
    default:
      return {
        card: 'bg-gradient-to-br from-gray-500 to-gray-600',
        badge: 'bg-gray-100 text-gray-700',
        badgeDark: 'bg-gray-50 text-gray-800 border border-gray-200',
      };
  }
};

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [revenueVsExpensesData, setRevenueVsExpensesData] = useState<any[]>([]);
  const [financialReport, setFinancialReport] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Завантажуємо фільтри з localStorage
  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem('expenses_filters');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load filters from storage:', e);
    }
    return {
      startDate: '',
      endDate: '',
      category: '',
      kiosk_id: '',
    };
  };

  const [filters, setFilters] = useState(loadFiltersFromStorage);
  const [view, setView] = useState<'paid' | 'planned'>('paid');
  const [isPlannedForm, setIsPlannedForm] = useState(false);

  // Зберігаємо фільтри в localStorage при зміні
  useEffect(() => {
    try {
      localStorage.setItem('expenses_filters', JSON.stringify(filters));
      const savedView = localStorage.getItem('expenses_view');
      if (savedView && (savedView === 'paid' || savedView === 'planned')) {
        setView(savedView as 'paid' | 'planned');
      }
    } catch (e) {
      console.error('Failed to save filters to storage:', e);
    }
  }, [filters]);

  // Зберігаємо view в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('expenses_view', view);
    } catch (e) {
      console.error('Failed to save view to storage:', e);
    }
  }, [view]);

  useEffect(() => {
    loadKiosks();
  }, []);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, view]);

  useEffect(() => {
    loadStats();
    loadChartData();
    loadRevenueVsExpenses();
    loadFinancialReport();
    loadComparison();
    loadOverdueCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadOverdueCount = async () => {
    try {
      const response = await api.get('/stats/notifications');
      if (response.data && Array.isArray(response.data.notifications)) {
        const overdueNotif = response.data.notifications.find((n: any) => n.type === 'overdue_expense');
        setOverdueCount(overdueNotif?.count || 0);
      } else {
        setOverdueCount(0);
      }
    } catch (error) {
      console.error('Failed to load overdue count:', error);
      setOverdueCount(0);
    }
  };

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Failed to load kiosks:', error);
      setKiosks([]);
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast.error('Помилка завантаження ларьків');
      }
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
      params.append('status', view);

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
      params.append('compare', 'true'); // Enable comparison

      const response = await api.get(`/expenses/stats?${params.toString()}`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadChartData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.category) params.append('category', filters.category);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/expenses/chart?${params.toString()}`);
      setChartData(response.data || []);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  };

  const loadRevenueVsExpenses = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/expenses/revenue-vs-expenses?${params.toString()}`);
      setRevenueVsExpensesData(response.data || []);
    } catch (error) {
      console.error('Failed to load revenue vs expenses data:', error);
    }
  };

  const loadFinancialReport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/finance/report?${params.toString()}`);
      setFinancialReport(response.data);
    } catch (error) {
      console.error('Failed to load financial report:', error);
    }
  };

  const loadComparison = async () => {
    try {
      const params = new URLSearchParams();
      params.append('period', 'month');
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/finance/comparison?${params.toString()}`);
      setComparison(response.data);
    } catch (error) {
      console.error('Failed to load comparison:', error);
    }
  };

  const handleExportFinancialReport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/finance/report?${params.toString()}`);
      const report = response.data;

      const headers = ['Показник', 'Значення'];
      const rows = [
        ['Виручка', `${parseFloat(String(report.revenue || 0)).toFixed(2)} ₴`],
        ['Витрати', `${parseFloat(String(report.expenses || 0)).toFixed(2)} ₴`],
        ['Собівартість', `${parseFloat(String(report.purchase_cost || 0)).toFixed(2)} ₴`],
        ['Маржа', `${parseFloat(String(report.margin || 0)).toFixed(2)} ₴`],
        ['Маржинальність', `${parseFloat(String(report.margin_percent || 0)).toFixed(2)}%`],
        ['Прибуток', `${parseFloat(String(report.profit || 0)).toFixed(2)} ₴`],
        ['Рентабельність', `${parseFloat(String(report.profit_margin || 0)).toFixed(2)}%`],
      ];

      const csv = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const dateRange = filters.startDate && filters.endDate
        ? `${filters.startDate}_${filters.endDate}`
        : format(new Date(), 'yyyy-MM');
      link.download = `financial_report_${dateRange}.csv`;
      link.click();
      toast.success('Фінансовий звіт успішно експортовано!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка експорту звіту');
    }
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      toast.info('Немає даних для експорту');
      return;
    }

    const headers = ['Дата', 'Категорія', 'Опис', 'Ларьок', 'Сума', 'Додав'];
    const rows = expenses.map((expense) => {
      const row = [
        format(new Date(expense.date), 'dd.MM.yyyy', { locale: uk }),
        CATEGORY_LABELS[expense.category] || expense.category,
        expense.description || '-',
        expense.kiosk_name || 'Всі ларьки',
        parseFloat(String(expense.amount || 0)).toFixed(2),
        expense.created_by_name || '-',
      ];
      return row.map((cell) => {
        const value = String(cell);
        if (value.includes(',') || value.includes(';') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
    });

    const csv = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Витрати успішно експортовано!');
    setShowExportModal(false);
  };

  const handleDelete = async (expense: Expense) => {
    const expenseDate = format(new Date(expense.date), 'dd.MM.yyyy', { locale: uk });
    const expenseAmount = parseFloat(String(expense.amount || 0)).toFixed(2);
    const expenseCategory = CATEGORY_LABELS[expense.category] || expense.category;
    
    const confirmMessage = `Ви впевнені, що хочете видалити цю витрату?\n\n` +
      `Категорія: ${expenseCategory}\n` +
      `Дата: ${expenseDate}\n` +
      `Сума: ${expenseAmount} ₴\n` +
      `${expense.description ? `Опис: ${expense.description}\n` : ''}\n` +
      `Цю дію неможливо скасувати.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      await api.delete(`/expenses/${expense.id}`);
      toast.success('Витрату успішно видалено!');
      loadExpenses();
      loadStats();
      loadFinancialReport();
      loadComparison();
      loadChartData();
      loadRevenueVsExpenses();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка видалення витрати');
    }
  };

  const handleMarkPaid = async (expense: Expense) => {
    const plannedDate = expense.planned_for || expense.date;
    const confirmMessage =
      `Позначити як "Оплачено"?\n\n` +
      `Категорія: ${CATEGORY_LABELS[expense.category] || expense.category}\n` +
      `${plannedDate ? `План: ${format(new Date(plannedDate), 'dd.MM.yyyy', { locale: uk })}\n` : ''}` +
      `Сума: ${parseFloat(String(expense.amount || 0)).toFixed(2)} ₴\n\n` +
      `Дата оплати буде сьогоднішня.`;

    if (!confirm(confirmMessage)) return;

    try {
      await api.post(`/expenses/${expense.id}/mark-paid`, {});
      toast.success('Позначено як оплачено');
      loadExpenses();
      loadStats();
      loadFinancialReport();
      loadComparison();
      loadChartData();
      loadRevenueVsExpenses();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка оновлення витрати');
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
      status: isPlannedForm ? 'planned' : 'paid',
      recurrence: isPlannedForm ? String(formData.get('recurrence') || 'none') : 'none',
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
      setIsPlannedForm(false);
      loadExpenses();
      loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка збереження витрати');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Витрати</h1>
            {overdueCount > 0 && (
              <button
                onClick={() => setView('planned')}
                className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition-colors"
              >
                🔴 Прострочені: {overdueCount}
              </button>
            )}
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setView('paid')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                view === 'paid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Факт
            </button>
            <button
              type="button"
              onClick={() => setView('planned')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                view === 'planned' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Заплановані
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1">Аналітика нижче рахує тільки оплачені витрати.</div>
        </div>
        <div className="flex gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn bg-green-500 hover:bg-green-600 text-white inline-flex items-center"
            >
              📥 Експорт
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleExportFinancialReport();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <span className="mr-2">📊</span>
                      Фінансовий звіт (підсумки)
                    </button>
                    <button
                      onClick={() => {
                        setShowExportModal(true);
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <span className="mr-2">📋</span>
                      Список витрат (детально)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => {
              setEditingExpense(null);
              setIsPlannedForm(view === 'planned');
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            + Додати витрату
          </button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            const today = format(new Date(), 'yyyy-MM-dd');
            setFilters({ ...filters, startDate: today, endDate: today });
          }}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          📅 Сьогодні
        </button>
        <button
          onClick={() => {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            setFilters({ ...filters, startDate: format(weekAgo, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') });
          }}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          📆 Останні 7 днів
        </button>
        <button
          onClick={() => {
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            setFilters({ ...filters, startDate: format(monthStart, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') });
          }}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          📊 Цей місяць
        </button>
        <button
          onClick={() => {
            setFilters({ ...filters, startDate: '', endDate: '' });
          }}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          🔄 Скинути
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{view === 'planned' ? 'План від' : 'Дата від'}</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{view === 'planned' ? 'План до' : 'Дата до'}</label>
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
              <option value="utilities">Комунальні</option>
              <option value="advertising">Реклама</option>
              <option value="salary">Зарплата</option>
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

      {/* Financial Summary & Comparison */}
      {financialReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="text-sm opacity-90 mb-1">Прибуток</div>
            <div className="text-2xl font-bold">{parseFloat(String(financialReport.profit || 0)).toFixed(2)} ₴</div>
            <div className="text-xs mt-2 opacity-80">
              Виручка: {parseFloat(String(financialReport.revenue || 0)).toFixed(2)} ₴
            </div>
          </div>
          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="text-sm opacity-90 mb-1">Витрати</div>
            <div className="text-2xl font-bold">{parseFloat(String(financialReport.expenses || 0)).toFixed(2)} ₴</div>
            <div className="text-xs mt-2 opacity-80">
              Собівартість: {parseFloat(String(financialReport.purchase_cost || 0)).toFixed(2)} ₴
            </div>
          </div>
          <div className="card bg-gradient-to-br from-teal-500 to-teal-600 text-white">
            <div className="text-sm opacity-90 mb-1">Маржа</div>
            <div className="text-2xl font-bold">{parseFloat(String(financialReport.margin || 0)).toFixed(2)} ₴</div>
            <div className="text-xs mt-2 opacity-80">
              Маржинальність: {parseFloat(String(financialReport.margin_percent || 0)).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Period Comparison */}
      {comparison && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Порівняння з попереднім місяцем</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Виручка</h3>
              <div className="flex items-baseline space-x-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {parseFloat(String(comparison.revenue.current || 0)).toFixed(2)} ₴
                  </div>
                  <div className="text-sm text-gray-500">
                    Попередній: {parseFloat(String(comparison.revenue.previous || 0)).toFixed(2)} ₴
                  </div>
                </div>
                <div className={`text-lg font-semibold ${
                  (comparison.revenue.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(comparison.revenue.change || 0) >= 0 ? '+' : ''}
                  {parseFloat(String(comparison.revenue.change || 0)).toFixed(2)} ₴
                  <div className="text-xs">
                    ({(comparison.revenue.percent_change || 0) >= 0 ? '+' : ''}
                    {parseFloat(String(comparison.revenue.percent_change || 0)).toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Витрати</h3>
              <div className="flex items-baseline space-x-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {parseFloat(String(comparison.expenses.current || 0)).toFixed(2)} ₴
                  </div>
                  <div className="text-sm text-gray-500">
                    Попередній: {parseFloat(String(comparison.expenses.previous || 0)).toFixed(2)} ₴
                  </div>
                </div>
                <div className={`text-lg font-semibold ${
                  comparison.expenses.change <= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(comparison.expenses.change || 0) >= 0 ? '+' : ''}
                  {parseFloat(String(comparison.expenses.change || 0)).toFixed(2)} ₴
                  <div className="text-xs">
                    ({(comparison.expenses.percent_change || 0) >= 0 ? '+' : ''}
                    {parseFloat(String(comparison.expenses.percent_change || 0)).toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Expenses Card - Professional slate/blue */}
          <div className="card bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Загальні витрати</div>
            <div className="text-2xl font-bold">{parseFloat(String(stats.total || 0)).toFixed(2)} ₴</div>
            {stats.comparison && (
              <div className="text-xs mt-2 opacity-80">
                {stats.comparison.difference >= 0 ? (
                  <span className="text-red-200">
                    ↑ +{parseFloat(String(stats.comparison.difference || 0)).toFixed(2)} ₴ ({parseFloat(String(stats.comparison.percent_change || 0)).toFixed(1)}%)
                  </span>
                ) : (
                  <span className="text-green-200">
                    ↓ {parseFloat(String(stats.comparison.difference || 0)).toFixed(2)} ₴ ({parseFloat(String(stats.comparison.percent_change || 0)).toFixed(1)}%)
                  </span>
                )}
                <span className="ml-2 opacity-70">vs попередній період</span>
              </div>
            )}
          </div>
          {/* Category Cards - Unique colors for each */}
          {stats.by_category.map((cat) => {
            const colors = getCategoryColors(cat.category);
            return (
              <div key={cat.category} className={`card ${colors.card} text-white shadow-lg`}>
                <div className="text-sm opacity-90 mb-1">{CATEGORY_LABELS[cat.category] || cat.category}</div>
                <div className="text-2xl font-bold">{parseFloat(String(cat.category_amount || 0)).toFixed(2)} ₴</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart - Expenses over time */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Витрати по днях</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'dd.MM', { locale: uk })}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number | string) => `${parseFloat(String(value || 0)).toFixed(2)} ₴`}
                  labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy', { locale: uk })}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="rent"
                  stroke="#3b82f6"
                  name="Оренда"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="purchase"
                  stroke="#10b981"
                  name="Закупівля"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="other"
                  stroke="#f59e0b"
                  name="Інше"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#64748b"
                  name="Всього"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart - Expenses by category */}
          {stats && stats.by_category.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Розподіл по категоріях</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.by_category.map((cat) => ({
                      name: CATEGORY_LABELS[cat.category] || cat.category,
                      value: parseFloat(String(cat.category_amount || 0)),
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${parseFloat(String((percent || 0) * 100)).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.by_category.map((cat, index) => {
                      const colors = getCategoryColors(cat.category);
                      const colorMap: Record<string, string> = {
                        'bg-gradient-to-br from-blue-500 to-blue-600': '#3b82f6',
                        'bg-gradient-to-br from-green-500 to-green-600': '#10b981',
                        'bg-gradient-to-br from-amber-500 to-amber-600': '#f59e0b',
                      };
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={colorMap[colors.card] || '#94a3b8'}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} ₴`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Revenue vs Expenses Chart */}
      {revenueVsExpensesData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Виручка vs Витрати</h2>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={revenueVsExpensesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), 'dd.MM', { locale: uk })}
              />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const nameMap: { [key: string]: string } = {
                    'revenue': 'Виручка',
                    'expenses': 'Витрати',
                    'profit': 'Прибуток',
                    'margin': 'Маржа',
                    'Виручка': 'Виручка',
                    'Витрати': 'Витрати',
                    'Прибуток': 'Прибуток',
                    'Маржа': 'Маржа',
                  };
                  const displayName = nameMap[name] || name;
                  return [`${parseFloat(String(value || 0)).toFixed(2)} ₴`, displayName];
                }}
                labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy', { locale: uk })}
              />
              <Legend 
                formatter={(value) => {
                  const nameMap: { [key: string]: string } = {
                    'revenue': 'Виручка',
                    'expenses': 'Витрати',
                    'profit': 'Прибуток',
                    'margin': 'Маржа',
                    'Виручка': 'Виручка',
                    'Витрати': 'Витрати',
                    'Прибуток': 'Прибуток',
                    'Маржа': 'Маржа',
                  };
                  return nameMap[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                name="Виручка"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                name="Витрати"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#14b8a6"
                name="Прибуток"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
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
                  <th>{view === 'planned' ? 'Заплановано на' : 'Дата'}</th>
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
                  expenses.map((expense) => {
                    const categoryColors = getCategoryColors(expense.category);
                    const status = expense.status || 'paid';
                    const displayDate = status === 'planned'
                      ? (expense.planned_for || expense.date)
                      : (expense.paid_at || expense.date);
                    const todayISO = new Date().toISOString().split('T')[0];
                    const isOverdue = status === 'planned' && !!displayDate && String(displayDate) < todayISO;
                    return (
                      <tr key={expense.id}>
                        <td className="text-gray-700">
                          <div className="flex flex-col">
                            <span>{format(new Date(displayDate), 'dd.MM.yyyy', { locale: uk })}</span>
                            {status === 'planned' && (
                              <span
                                className={`mt-1 inline-flex w-fit px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {isOverdue ? 'Прострочено' : 'Заплановано'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${categoryColors.badgeDark}`}>
                            {CATEGORY_LABELS[expense.category] || expense.category}
                          </span>
                        </td>
                        <td className="text-gray-700">{expense.description || '-'}</td>
                        <td className="text-gray-700">{expense.kiosk_name || 'Всі ларьки'}</td>
                        <td className="font-semibold text-slate-700">
                          {parseFloat(String(expense.amount || 0)).toFixed(2)} ₴
                        </td>
                        <td className="text-sm text-gray-600">{expense.created_by_name || '-'}</td>
                      <td>
                        <div className="flex space-x-2">
                          {status === 'planned' && (
                            <button
                              onClick={() => handleMarkPaid(expense)}
                              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 text-sm font-medium px-2 py-1 rounded transition-colors"
                              title="Позначити як оплачено"
                            >
                              ✅ Оплачено
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingExpense(expense);
                              setIsPlannedForm((expense.status || 'paid') === 'planned');
                              setShowModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                            title="Редагувати витрату"
                          >
                            ✏️ Редагувати
                          </button>
                          <button
                            onClick={() => handleDelete(expense)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium px-2 py-1 rounded transition-colors"
                            title="Видалити витрату"
                          >
                            🗑️ Видалити
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700">
                      Всього:
                    </td>
                    <td className="px-4 py-3 font-bold text-lg text-slate-800">
                      {parseFloat(String(expenses.reduce((sum, exp) => sum + parseFloat(String(exp.amount || 0)), 0))).toFixed(2)} ₴
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={isPlannedForm}
                    onChange={(e) => setIsPlannedForm(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Запланована витрата
                </label>
                <select
                  name="recurrence"
                  defaultValue={String(editingExpense?.recurrence || 'none')}
                  className={`input !py-2 !h-10 sm:w-44 ${!isPlannedForm ? 'opacity-60' : ''}`}
                  disabled={!isPlannedForm}
                  title="Періодичність (для оренди можна поставити щомісяця)"
                >
                  <option value="none">Разова</option>
                  <option value="monthly">Щомісяця</option>
                </select>
              </div>
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
                  <option value="utilities">Комунальні</option>
                  <option value="advertising">Реклама</option>
                  <option value="salary">Зарплата</option>
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
                <label className="block text-sm font-medium mb-1">{isPlannedForm ? 'Заплановано на *' : 'Дата оплати *'}</label>
                <input
                  type="date"
                  name="date"
                  defaultValue={
                    isPlannedForm
                      ? (editingExpense?.planned_for || editingExpense?.date || new Date().toISOString().split('T')[0])
                      : (editingExpense?.paid_at || editingExpense?.date || new Date().toISOString().split('T')[0])
                  }
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
                    setIsPlannedForm(false);
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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Експорт витрат</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Буде експортовано {expenses.length} записів витрат з поточними фільтрами.
              </p>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="btn btn-primary flex-1"
                >
                  Експортувати CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

