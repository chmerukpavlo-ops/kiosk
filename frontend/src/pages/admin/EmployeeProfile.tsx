import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { format, startOfWeek, addDays } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';

interface EmployeeProfile {
  id: number;
  username: string;
  full_name: string;
  kiosk_id?: number;
  kiosk_name?: string;
  stats: {
    total: {
      total_sales: string;
      total_revenue: string;
      total_items: string;
    };
    today: {
      sales_today: string;
      revenue_today: string;
    };
  };
  recent_sales: Array<{
    id: number;
    product_name: string;
    quantity: number;
    price: string;
    created_at: string;
    kiosk_name?: string;
  }>;
}

interface ScheduleEntry {
  id: number;
  date: string;
  shift_start?: string;
  shift_end?: string;
  status: string;
}

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'schedule'>('overview');

  const currentWeek = new Date();
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (id) {
      loadProfile();
      loadSchedule();
    }
  }, [id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/employees/${id}`);
      setProfile(response.data);
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      toast.error(error.response?.data?.error || 'Помилка завантаження профілю');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const response = await api.get(
        `/schedule?employee_id=${id}&startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      setSchedule(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load schedule:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-gray-600 mb-2">Завантаження профілю...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Профіль не знайдено</div>
        <Link to="/employees" className="btn btn-primary">
          Повернутися до списку
        </Link>
      </div>
    );
  }

  const totalRevenue = parseFloat(profile.stats.total.total_revenue || '0');
  const todayRevenue = parseFloat(profile.stats.today.revenue_today || '0');
  const totalSales = parseInt(profile.stats.total.total_sales || '0');
  const todaySales = parseInt(profile.stats.today.sales_today || '0');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/employees')}
            className="text-gray-600 hover:text-gray-900 text-xl"
            title="Назад"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
            <div className="text-sm text-gray-600 mt-1">
              {profile.kiosk_name || 'Не призначено до ларьку'} • @{profile.username}
            </div>
          </div>
        </div>
        <Link to={`/schedule?employee=${id}`} className="btn btn-secondary">
          Графік роботи
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Огляд' },
            { id: 'sales', label: 'Продажі' },
            { id: 'schedule', label: 'Графік' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="text-sm opacity-90 mb-1">Всього продажів</div>
              <div className="text-3xl font-bold">{totalSales.toLocaleString()}</div>
            </div>
            <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="text-sm opacity-90 mb-1">Загальна виручка</div>
              <div className="text-3xl font-bold">{totalRevenue.toLocaleString('uk-UA')} ₴</div>
            </div>
            <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="text-sm opacity-90 mb-1">Продажів сьогодні</div>
              <div className="text-3xl font-bold">{todaySales}</div>
            </div>
            <div className="card bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <div className="text-sm opacity-90 mb-1">Виручка сьогодні</div>
              <div className="text-3xl font-bold">{todayRevenue.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Останні продажі</h2>
            {profile.recent_sales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Немає продажів</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Кількість</th>
                      <th>Ціна</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.recent_sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id}>
                        <td>{sale.product_name || '—'}</td>
                        <td>{sale.quantity}</td>
                        <td className="font-semibold">{parseFloat(sale.price).toLocaleString('uk-UA')} ₴</td>
                        <td className="text-sm text-gray-600">
                          {format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Всі продажі</h2>
          {profile.recent_sales.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Немає продажів</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Кількість</th>
                    <th>Ціна</th>
                    <th>Ларьок</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.recent_sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-medium">{sale.product_name || '—'}</td>
                      <td>{sale.quantity}</td>
                      <td className="font-semibold">{parseFloat(sale.price).toLocaleString('uk-UA')} ₴</td>
                      <td>{sale.kiosk_name || '—'}</td>
                      <td className="text-sm text-gray-600">
                        {format(new Date(sale.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">
            Графік на тиждень {format(weekStart, 'dd.MM', { locale: uk })} – {format(weekEnd, 'dd.MM', { locale: uk })}
          </h2>
          {schedule.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Немає запланованих змін</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>День</th>
                    <th>Дата</th>
                    <th>Початок</th>
                    <th>Кінець</th>
                    <th>Тривалість</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((entry) => {
                      const start = entry.shift_start ? entry.shift_start.slice(0, 5) : '—';
                      const end = entry.shift_end ? entry.shift_end.slice(0, 5) : '—';
                      const date = new Date(entry.date);
                      let duration = 0;
                      if (entry.shift_start && entry.shift_end) {
                        const [h1, m1] = entry.shift_start.split(':').map(Number);
                        const [h2, m2] = entry.shift_end.split(':').map(Number);
                        duration = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
                      }

                      const statusColors: Record<string, string> = {
                        scheduled: 'bg-blue-100 text-blue-700',
                        started: 'bg-emerald-100 text-emerald-700',
                        completed: 'bg-gray-100 text-gray-700',
                        absent: 'bg-red-100 text-red-700',
                      };

                      const statusLabels: Record<string, string> = {
                        scheduled: 'Заплановано',
                        started: 'На зміні',
                        completed: 'Завершено',
                        absent: 'Відсутній',
                      };

                      return (
                        <tr key={entry.id}>
                          <td className="font-medium">{format(date, 'EEEE', { locale: uk })}</td>
                          <td>{format(date, 'dd.MM.yyyy', { locale: uk })}</td>
                          <td>{start}</td>
                          <td>{end}</td>
                          <td>{duration > 0 ? `${duration.toFixed(1)} год` : '—'}</td>
                          <td>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[entry.status] || 'bg-gray-100 text-gray-700'}`}>
                              {statusLabels[entry.status] || entry.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

