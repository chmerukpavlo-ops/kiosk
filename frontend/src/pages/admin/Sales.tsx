import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Sale {
  id: number;
  product_name: string;
  seller_name: string;
  kiosk_name: string;
  price: number;
  quantity: number;
  commission: number;
  created_at: string;
}

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    seller_id: '',
    kiosk_id: '',
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);

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
      if (filters.seller_id) params.append('seller_id', filters.seller_id);
      if (filters.kiosk_id) params.append('kiosk_id', filters.kiosk_id);

      const response = await api.get(`/sales?${params.toString()}`);
      setSales(response.data || []);
    } catch (error: any) {
      console.error('Failed to load sales:', error);
      setSales([]);
      // Показуємо помилку користувачу
      if (error.response?.status === 403 || error.response?.status === 401) {
        alert('Немає доступу до цієї сторінки');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (sales.length === 0) {
      alert('Немає даних для експорту');
      return;
    }
    
    const headers = ['ID', 'Товар', 'Продавець', 'Ларьок', 'Час', 'Сума', 'Комісія'];
    const rows = sales.map((sale) => [
      sale.id,
      sale.product_name || '-',
      sale.seller_name || '-',
      sale.kiosk_name || '-',
      sale.created_at ? format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk }) : '-',
      parseFloat(sale.price || 0).toFixed(2),
      parseFloat(sale.commission || 0).toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + (parseFloat(sale.price) || 0), 0);
  const totalCommission = sales.reduce((sum, sale) => sum + (parseFloat(sale.commission) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Продажі</h1>
        <button onClick={handleExportCSV} className="btn btn-primary">
          Експорт CSV
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
            <label className="block text-sm font-medium mb-1">Продавець</label>
            <select
              value={filters.seller_id}
              onChange={(e) => setFilters({ ...filters, seller_id: e.target.value })}
              className="input"
            >
              <option value="">Всі продавці</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
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
                <option key={kiosk.id} value={kiosk.id}>
                  {kiosk.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-90 mb-1">Загальна виручка</div>
          <div className="text-2xl font-bold">{totalRevenue.toFixed(2)} ₴</div>
        </div>
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90 mb-1">Загальна комісія</div>
          <div className="text-2xl font-bold">{totalCommission.toFixed(2)} ₴</div>
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
                  <th>Комісія</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
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
                      {parseFloat(sale.price || 0).toFixed(2)} ₴
                    </td>
                    <td className="text-purple-600">{parseFloat(sale.commission || 0).toFixed(2)} ₴</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

