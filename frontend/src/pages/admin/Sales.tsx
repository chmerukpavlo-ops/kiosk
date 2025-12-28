import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format, startOfToday, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';
import { exportToExcel, formatCurrency, formatDate } from '../../lib/excelExport';

interface Sale {
  id: number;
  product_name: string;
  seller_name: string;
  kiosk_name: string;
  price: number;
  quantity: number;
  created_at: string;
}

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    id: true,
    product_name: true,
    seller_name: true,
    kiosk_name: true,
    created_at: true,
    price: true,
    quantity: false,
  });
  // Завантажуємо фільтри з localStorage
  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem('sales_filters');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load filters from storage:', e);
    }
    return {
      startDate: '',
      endDate: '',
      seller_id: '',
      kiosk_id: '',
    };
  };

  const [filters, setFilters] = useState(loadFiltersFromStorage);
  const [employees, setEmployees] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);

  // Зберігаємо фільтри в localStorage при зміні
  useEffect(() => {
    try {
      localStorage.setItem('sales_filters', JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to storage:', e);
    }
  }, [filters]);

  useEffect(() => {
    loadEmployees();
    loadKiosks();
    loadSales();
  }, [filters]);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data || []);
    } catch (error: any) {
      console.error('Failed to load employees:', error);
      // Якщо помилка доступу, просто залишаємо пустий масив
      if (error.response?.status === 403 || error.response?.status === 401) {
        setEmployees([]);
      }
    }
  };

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data || []);
    } catch (error: any) {
      console.error('Failed to load kiosks:', error);
      setKiosks([]);
    }
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.seller_id) params.append('seller_id', String(filters.seller_id));
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));

      const response = await api.get(`/sales?${params.toString()}`);
      setSales(response.data || []);
    } catch (error: any) {
      console.error('Failed to load sales:', error);
      setSales([]);
      // Показуємо помилку користувачу
      if (error.response?.status === 403 || error.response?.status === 401) {
        toast.error('Немає доступу до цієї сторінки');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (sales.length === 0) {
      toast.error('Немає даних для експорту');
      return;
    }

    try {
      const columns = [
        { key: 'id', label: 'ID', width: 10 },
        { key: 'created_at', label: 'Дата', width: 20, format: formatDate },
        { key: 'product_name', label: 'Товар', width: 30 },
        { key: 'seller_name', label: 'Продавець', width: 25 },
        { key: 'kiosk_name', label: 'Кіоск', width: 20 },
        { key: 'quantity', label: 'Кількість', width: 12 },
        { key: 'price', label: 'Ціна', width: 15, format: formatCurrency },
      ];

      // Filter columns based on exportColumns settings
      const activeColumns = columns.filter((col) => {
        const key = col.key as keyof typeof exportColumns;
        return exportColumns[key] !== false;
      });

      // Prepare data with calculated totals
      const dataWithTotals = sales.map((sale) => ({
        ...sale,
        total: parseFloat(String(sale.price || 0)) * (sale.quantity || 0),
      }));

      await exportToExcel({
        filename: 'sales',
        sheetName: 'Продажі',
        columns: activeColumns,
        data: dataWithTotals,
        includeHeaders: true,
        formatNumbers: true,
        formatDates: true,
      });

      toast.success('Експорт у Excel завершено');
      setShowExportModal(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Помилка експорту: ' + (error.message || 'Невідома помилка'));
    }
  };

  const handleExportCSV = () => {
    if (sales.length === 0) {
      toast.error('Немає даних для експорту');
      return;
    }

    const selectedColumns = Object.entries(exportColumns)
      .filter(([_, selected]) => selected)
      .map(([key]) => key);

    if (selectedColumns.length === 0) {
      toast.error('Виберіть хоча б одну колонку для експорту');
      return;
    }

    const headers: string[] = [];
    const headerMap: Record<string, string> = {
      id: 'ID',
      product_name: 'Товар',
      seller_name: 'Продавець',
      kiosk_name: 'Ларьок',
      created_at: 'Час',
      price: 'Сума',
      quantity: 'Кількість',
    };

    selectedColumns.forEach((col) => {
      if (headerMap[col]) {
        headers.push(headerMap[col]);
      }
    });

    const rows = sales.map((sale) => {
      const row: string[] = [];
      selectedColumns.forEach((col) => {
        let value = '';
        switch (col) {
          case 'id':
            value = String(sale.id);
            break;
          case 'product_name':
            value = sale.product_name || '-';
            break;
          case 'seller_name':
            value = sale.seller_name || '-';
            break;
          case 'kiosk_name':
            value = sale.kiosk_name || '-';
            break;
          case 'created_at':
            value = sale.created_at ? format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk }) : '-';
            break;
          case 'price':
            value = parseFloat(String(sale.price || 0)).toFixed(2);
            break;
          case 'quantity':
            value = String(sale.quantity || 1);
            break;
        }
        // Екранування ком та лапок для CSV
        if (value.includes(',') || value.includes(';') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        row.push(value);
      });
      return row;
    });

    // Використовуємо крапку з комою як роздільник для кращої сумісності з Excel
    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Продажі успішно експортовано');
    setShowExportModal(false);
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + (parseFloat(String(sale.price || 0)) || 0), 0);

  const applyQuickFilter = (type: 'today' | 'week' | 'month') => {
    const today = startOfToday();
    let startDate = '';
    let endDate = format(today, 'yyyy-MM-dd');

    switch (type) {
      case 'today':
        startDate = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        startDate = format(subDays(today, 7), 'yyyy-MM-dd');
        break;
      case 'month':
        startDate = format(startOfMonth(today), 'yyyy-MM-dd');
        endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
    }

    setFilters({
      ...filters,
      startDate,
      endDate,
    });
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      seller_id: '',
      kiosk_id: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Продажі</h1>
        <button onClick={() => setShowExportModal(true)} className="btn btn-primary">
          📥 Експорт Excel
        </button>
      </div>

      {/* Quick Filters */}
      <div className="card bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Швидкі фільтри:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyQuickFilter('today')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              📅 Сьогодні
            </button>
            <button
              onClick={() => applyQuickFilter('week')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              📆 Останні 7 днів
            </button>
            <button
              onClick={() => applyQuickFilter('month')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              📊 Цей місяць
            </button>
            {(filters.startDate || filters.endDate) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 border-2 border-gray-300 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                ✕ Скинути
              </button>
            )}
          </div>
        </div>
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
            <label className="block text-sm font-medium mb-1">Продавець</label>
            <select
              value={filters.seller_id}
              onChange={(e) => setFilters({ ...filters, seller_id: e.target.value })}
              className="input"
            >
              <option value="">Всі продавці</option>
              {employees.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.full_name}
                </option>
              ))}
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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-90 mb-1">Загальна виручка</div>
          <div className="text-2xl font-bold">{totalRevenue.toFixed(2)} ₴</div>
        </div>
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90 mb-1">Всього продажів</div>
          <div className="text-2xl font-bold">{sales.length}</div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">Завантаження...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Назва товару</th>
                  <th>Хто продав</th>
                  <th>Ларьок</th>
                  <th>Час продажу</th>
                  <th>Сума</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      Немає продажів
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>#{sale.id}</td>
                      <td className="font-medium">{sale.product_name || '-'}</td>
                      <td>{sale.seller_name || '-'}</td>
                      <td>{sale.kiosk_name || '-'}</td>
                    <td className="text-sm text-gray-600">
                      {sale.created_at ? format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk }) : '-'}
                    </td>
                    <td className="font-semibold text-green-600">
                      {parseFloat(String(sale.price || 0)).toFixed(2)} ₴
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Експорт продажів</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Виберіть колонки для експорту:</label>
                <div className="space-y-2">
                  {Object.entries(exportColumns).map(([key, value]) => (
                    <label key={key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) =>
                          setExportColumns({ ...exportColumns, [key]: e.target.checked })
                        }
                        className="rounded"
                      />
                      <span className="text-sm">
                        {key === 'id' && 'ID'}
                        {key === 'product_name' && 'Товар'}
                        {key === 'seller_name' && 'Продавець'}
                        {key === 'kiosk_name' && 'Ларьок'}
                        {key === 'created_at' && 'Час продажу'}
                        {key === 'price' && 'Сума'}
                        {key === 'quantity' && 'Кількість'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setExportColumns({
                      id: true,
                      product_name: true,
                      seller_name: true,
                      kiosk_name: true,
                      created_at: true,
                      price: true,
                      quantity: true,
                    });
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Всі
                </button>
                <button
                  onClick={() => {
                    setExportColumns({
                      id: false,
                      product_name: true,
                      seller_name: false,
                      kiosk_name: false,
                      created_at: true,
                      price: true,
                      quantity: false,
                    });
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Мінімальний
                </button>
                <button
                  onClick={() => {
                    setExportColumns({
                      id: true,
                      product_name: true,
                      seller_name: true,
                      kiosk_name: true,
                      created_at: true,
                      price: true,
                      quantity: false,
                    });
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Для бухгалтерії
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleExportExcel}
                  className="btn btn-primary flex-1"
                >
                  Експортувати Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

