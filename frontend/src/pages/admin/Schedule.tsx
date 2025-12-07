import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { uk } from 'date-fns/locale';

interface ScheduleEntry {
  id: number;
  employee_id: number;
  employee_name: string;
  kiosk_id: number;
  kiosk_name: string;
  date: string;
  shift_start?: string;
  shift_end?: string;
  status: string;
}

export function Schedule() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    loadEmployees();
    loadKiosks();
    loadSchedule();
  }, [currentWeek]);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    }
  };

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const response = await api.get(
        `/schedule?startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      setSchedule(response.data);
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      employee_id: parseInt(formData.get('employee_id') as string),
      kiosk_id: parseInt(formData.get('kiosk_id') as string),
      date: selectedDate,
      shift_start: formData.get('shift_start') || null,
      shift_end: formData.get('shift_end') || null,
      status: formData.get('status') || 'scheduled',
    };

    try {
      await api.post('/schedule', data);
      setShowModal(false);
      setSelectedDate('');
      loadSchedule();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка збереження графіка');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.put(`/schedule/${id}`, { status });
      loadSchedule();
    } catch (error) {
      alert('Помилка оновлення статусу');
    }
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getScheduleForDay = (date: Date) => {
    return schedule.filter((entry) => isSameDay(new Date(entry.date), date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'started':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      case 'absent':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Заплановано';
      case 'started':
        return 'На зміні';
      case 'completed':
        return 'Завершено';
      case 'absent':
        return 'Відсутній';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Графік роботи</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
            className="btn btn-secondary"
          >
            ← Попередній тиждень
          </button>
          <button
            onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            className="btn btn-secondary"
          >
            Наступний тиждень →
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="btn btn-primary"
          >
            Сьогодні
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-12">Завантаження...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Продавець</th>
                  <th>Ларьок</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className="text-center min-w-[120px]">
                      <div className="text-xs font-normal text-gray-500 mb-1">
                        {format(day, 'EEEE', { locale: uk })}
                      </div>
                      <div className="font-semibold">
                        {format(day, 'dd.MM', { locale: uk })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-medium">{employee.full_name}</td>
                    <td>{employee.kiosk_name || '-'}</td>
                    {weekDays.map((day) => {
                      const daySchedule = getScheduleForDay(day).filter(
                        (s) => s.employee_id === employee.id
                      );
                      return (
                        <td key={day.toISOString()} className="text-center">
                          {daySchedule.length > 0 ? (
                            <div className="space-y-1">
                              {daySchedule.map((entry) => (
                                <div
                                  key={entry.id}
                                  className={`p-2 rounded text-xs ${getStatusColor(entry.status)}`}
                                >
                                  <div className="font-medium">
                                    {entry.shift_start && entry.shift_end
                                      ? `${entry.shift_start} - ${entry.shift_end}`
                                      : 'Без часу'}
                                  </div>
                                  <div className="mt-1">{getStatusLabel(entry.status)}</div>
                                  <div className="mt-1 flex space-x-1">
                                    {entry.status === 'scheduled' && (
                                      <button
                                        onClick={() => handleStatusChange(entry.id, 'started')}
                                        className="text-xs bg-green-500 text-white px-2 py-0.5 rounded"
                                      >
                                        Почати
                                      </button>
                                    )}
                                    {entry.status === 'started' && (
                                      <button
                                        onClick={() => handleStatusChange(entry.id, 'completed')}
                                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                                      >
                                        Завершити
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedDate(format(day, 'yyyy-MM-dd'));
                                setShowModal(true);
                              }}
                              className="text-gray-400 hover:text-primary-600 text-2xl"
                            >
                              +
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Додати зміну</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Дата</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Продавець *</label>
                <select name="employee_id" className="input" required>
                  <option value="">Виберіть продавця</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ларьок *</label>
                <select name="kiosk_id" className="input" required>
                  <option value="">Виберіть ларьок</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={String(kiosk.id)}>
                      {kiosk.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Початок зміни</label>
                  <input type="time" name="shift_start" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Кінець зміни</label>
                  <input type="time" name="shift_end" className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Статус</label>
                <select name="status" defaultValue="scheduled" className="input">
                  <option value="scheduled">Заплановано</option>
                  <option value="started">На зміні</option>
                  <option value="completed">Завершено</option>
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
                    setSelectedDate('');
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

