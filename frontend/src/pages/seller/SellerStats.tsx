import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface ScheduleEntry {
  id: number;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  status: string;
  kiosk_name: string;
}

interface DailyStats {
  date: string;
  revenue: number;
  sales_count: number;
  hours_worked: number;
  salary: number;
}

type TabType = 'schedule' | 'revenue' | 'salary';

export function SellerStats() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [dateRange, setDateRange] = useState({
    start: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    loadData();
  }, [dateRange, user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Завантажуємо графік роботи
      const scheduleRes = await api.get('/schedule', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      });
      setSchedule(scheduleRes.data);

      // Завантажуємо продажі для розрахунку виручки та зарплати
      const salesRes = await api.get('/sales', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      });

      // Групуємо продажі по днях та розраховуємо статистику
      const salesByDate: Record<string, { revenue: number; count: number }> = {};
      salesRes.data.forEach((sale: any) => {
        const date = sale.created_at.split('T')[0];
        if (!salesByDate[date]) {
          salesByDate[date] = { revenue: 0, count: 0 };
        }
        salesByDate[date].revenue += parseFloat(sale.price || 0);
        salesByDate[date].count += 1;
      });

      // Об'єднуємо графік та продажі для розрахунку зарплати
      const stats: DailyStats[] = [];
      const scheduleByDate: Record<string, ScheduleEntry> = {};
      scheduleRes.data.forEach((entry: ScheduleEntry) => {
        scheduleByDate[entry.date] = entry;
      });

      // Створюємо записи для кожного дня в діапазоні
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const scheduleEntry = scheduleByDate[dateStr];
        const salesData = salesByDate[dateStr] || { revenue: 0, count: 0 };

        // Розраховуємо години роботи
        let hours = 0;
        if (scheduleEntry?.shift_start && scheduleEntry?.shift_end) {
          const startTime = new Date(`2000-01-01T${scheduleEntry.shift_start}`);
          const endTime = new Date(`2000-01-01T${scheduleEntry.shift_end}`);
          hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          if (hours < 0) hours += 24; // Обробка нічних змін
        }

        // Розраховуємо зарплату (приклад: 5% від виручки або фіксована ставка за годину)
        // Тут можна змінити логіку розрахунку зарплати
        const hourlyRate = 100; // 100 грн за годину (приклад)
        const commissionRate = 0.05; // 5% від виручки
        const salary = hours * hourlyRate + salesData.revenue * commissionRate;

        stats.push({
          date: dateStr,
          revenue: salesData.revenue,
          sales_count: salesData.count,
          hours_worked: hours,
          salary: salary,
        });
      }

      // Сортуємо за датою (від новіших до старіших)
      stats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDailyStats(stats);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.substring(0, 5); // HH:mm
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'd MMM yyyy', { locale: uk });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      scheduled: { label: 'Заплановано', className: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Відпрацьовано', className: 'bg-green-100 text-green-700' },
      absent: { label: 'Відсутній', className: 'bg-red-100 text-red-700' },
      sick: { label: 'Лікарняний', className: 'bg-yellow-100 text-yellow-700' },
    };
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  const totalRevenue = dailyStats.reduce((sum, day) => sum + day.revenue, 0);
  const totalSalary = dailyStats.reduce((sum, day) => sum + day.salary, 0);
  const totalHours = dailyStats.reduce((sum, day) => sum + day.hours_worked, 0);
  const totalSales = dailyStats.reduce((sum, day) => sum + day.sales_count, 0);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'schedule', label: 'Графік', icon: '📅' },
    { id: 'revenue', label: 'Виручка', icon: '💰' },
    { id: 'salary', label: 'Зарплата', icon: '💵' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header з табами */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Моя статистика
          </h2>

          {/* Date Range Picker */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100"
            />
            <span className="self-center text-gray-500 dark:text-gray-400">до</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Виручка</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {totalRevenue.toFixed(2)} ₴
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Зарплата</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {totalSalary.toFixed(2)} ₴
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Години</div>
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {totalHours.toFixed(1)} год
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Продажі</div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {totalSales}
                </div>
              </div>
            </div>

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Кіоск
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Початок
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Кінець
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Статус
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {schedule.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            Немає записів у графіку
                          </td>
                        </tr>
                      ) : (
                        schedule.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              {entry.kiosk_name || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              {formatTime(entry.shift_start)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              {formatTime(entry.shift_end)}
                            </td>
                            <td className="px-4 py-3">{getStatusBadge(entry.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Виручка
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Продажі
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dailyStats.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            Немає даних
                          </td>
                        </tr>
                      ) : (
                        dailyStats
                          .filter((day) => day.revenue > 0)
                          .map((day) => (
                            <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                {formatDate(day.date)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                                {day.revenue.toFixed(2)} ₴
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                                {day.sales_count}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Salary Tab */}
            {activeTab === 'salary' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Години
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Виручка
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Зарплата
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dailyStats.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            Немає даних
                          </td>
                        </tr>
                      ) : (
                        dailyStats
                          .filter((day) => day.hours_worked > 0 || day.revenue > 0)
                          .map((day) => (
                            <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                {formatDate(day.date)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                                {day.hours_worked.toFixed(1)} год
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                                {day.revenue.toFixed(2)} ₴
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                                {day.salary.toFixed(2)} ₴
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

