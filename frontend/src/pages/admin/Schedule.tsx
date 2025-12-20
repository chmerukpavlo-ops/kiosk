import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { format, startOfWeek, addDays, isSameDay, isWithinInterval } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from '../../components/Toast';

interface ScheduleEntry {
  id: number;
  employee_id: number;
  employee_name: string;
  kiosk_id: number;
  kiosk_name: string;
  date: string; // yyyy-MM-dd
  shift_start?: string;
  shift_end?: string;
  status: string;
}

type ShiftTemplate = { label: string; start: string; end: string };

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { label: '09:00–21:00', start: '09:00', end: '21:00' },
  { label: '09:00–22:00', start: '09:00', end: '22:00' },
  { label: '10:00–22:00', start: '10:00', end: '22:00' },
];

function normalizeTime(t?: string | null) {
  if (!t) return '';
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function timeToMinutes(t?: string | null) {
  const v = normalizeTime(t);
  if (!v) return null;
  const [hh, mm] = v.split(':');
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function calcShiftHours(start?: string | null, end?: string | null) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  if (e <= s) return 0;
  return (e - s) / 60;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'started':
      return 'bg-emerald-100 text-emerald-700';
    case 'completed':
      return 'bg-gray-100 text-gray-700';
    case 'absent':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getStatusLabel(status: string) {
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
}

function hoursBadgeClass(hours: number) {
  // "біля 40 год" — м'які пороги
  if (hours >= 38 && hours <= 42) return 'bg-emerald-100 text-emerald-700';
  if ((hours > 42 && hours <= 46) || (hours > 0 && hours < 38)) return 'bg-amber-100 text-amber-700';
  if (hours > 46) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

export function Schedule() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [selectedKioskId, setSelectedKioskId] = useState<string>('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [shiftStart, setShiftStart] = useState<string>('');
  const [shiftEnd, setShiftEnd] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyDays, setCopyDays] = useState<Set<string>>(new Set());
  const [copyingShift, setCopyingShift] = useState(false);

  useEffect(() => {
    loadEmployees();
    loadKiosks();
  }, []);

  useEffect(() => {
    if (selectedKioskId) {
      loadSchedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, selectedKioskId]);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees([]);
    }
  };

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      const arr = Array.isArray(response.data) ? response.data : [];
      setKiosks(arr);
      if (!selectedKioskId && arr.length > 0) setSelectedKioskId(String(arr[0].id));
    } catch (error) {
      console.error('Failed to load kiosks:', error);
      setKiosks([]);
    }
  };

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/schedule?startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      setSchedule(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setSchedule([]);
      toast.error('Помилка завантаження графіка');
    } finally {
      setLoading(false);
    }
  };

  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of schedule) {
      const key = `${entry.employee_id}-${entry.date}`;
      const arr = map.get(key) || [];
      arr.push(entry);
      map.set(key, arr);
    }
    return map;
  }, [schedule]);

  const hoursByEmployee = useMemo(() => {
    const result = new Map<number, number>();
    for (const entry of schedule) {
      const d = new Date(entry.date);
      if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) continue;
      const hours = calcShiftHours(entry.shift_start, entry.shift_end);
      result.set(entry.employee_id, (result.get(entry.employee_id) || 0) + hours);
    }
    return result;
  }, [schedule, weekStart, weekEnd]);

  const daysFilledByEmployee = useMemo(() => {
    const result = new Map<number, number>();
    for (const employee of employees) {
      let filled = 0;
      for (const day of weekDays) {
        const dateISO = format(day, 'yyyy-MM-dd');
        const entries = (scheduleMap.get(`${employee.id}-${dateISO}`) || []).filter(
          (e) => String(e.kiosk_id) === String(selectedKioskId)
        );
        if (entries.length > 0) filled++;
      }
      result.set(employee.id, filled);
    }
    return result;
  }, [scheduleMap, employees, weekDays, selectedKioskId]);

  const selectedKiosk = useMemo(() => {
    return kiosks.find((k) => String(k.id) === String(selectedKioskId));
  }, [kiosks, selectedKioskId]);

  const weekStats = useMemo(() => {
    let totalDays = 0;
    let filledDays = 0;
    employees.forEach((emp) => {
      totalDays += 7;
      filledDays += daysFilledByEmployee.get(emp.id) || 0;
    });
    const percentage = totalDays > 0 ? Math.round((filledDays / totalDays) * 100) : 0;
    return { totalDays, filledDays, percentage };
  }, [employees, daysFilledByEmployee]);

  // Фільтрація продавців по пошуку та вибору
  const filteredEmployees = useMemo(() => {
    let filtered = employees;
    
    // Фільтр по пошуку
    if (employeeSearch.trim()) {
      const searchLower = employeeSearch.toLowerCase().trim();
      filtered = filtered.filter((emp) =>
        emp.full_name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Фільтр по вибору
    if (selectedEmployeeFilter) {
      filtered = filtered.filter((emp) => String(emp.id) === selectedEmployeeFilter);
    }
    
    return filtered;
  }, [employees, employeeSearch, selectedEmployeeFilter]);

  const openCreate = (employeeId: number, dateISO: string) => {
    setEditingEntry(null);
    setSelectedEmployeeId(employeeId);
    setSelectedDate(dateISO);
    setShiftStart('');
    setShiftEnd('');
    setStatus('scheduled');
    setShowModal(true);
  };

  const openEdit = (entry: ScheduleEntry) => {
    setEditingEntry(entry);
    setSelectedEmployeeId(entry.employee_id);
    setSelectedDate(entry.date);
    setShiftStart(normalizeTime(entry.shift_start));
    setShiftEnd(normalizeTime(entry.shift_end));
    setStatus(entry.status || 'scheduled');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setSelectedEmployeeId(null);
    setSelectedDate('');
    setShiftStart('');
    setShiftEnd('');
    setStatus('scheduled');
  };

  const applyTemplate = (tpl: ShiftTemplate) => {
    setShiftStart(tpl.start);
    setShiftEnd(tpl.end);
  };

  const saveEntry = async () => {
    if (!selectedEmployeeId || !selectedDate) return;
    if (!selectedKioskId) {
      toast.error('Спочатку створіть ларьок і виберіть його');
      return;
    }

    const s = timeToMinutes(shiftStart);
    const e = timeToMinutes(shiftEnd);
    if ((shiftStart && s === null) || (shiftEnd && e === null)) {
      toast.error('Невірний формат часу');
      return;
    }
    if (shiftStart && shiftEnd && s !== null && e !== null && e <= s) {
      toast.error('Кінець зміни має бути пізніше початку');
      return;
    }

    try {
      if (editingEntry) {
        const response = await api.put(`/schedule/${editingEntry.id}`, {
          shift_start: shiftStart || null,
          shift_end: shiftEnd || null,
          status,
        });
        
        // Оновлюємо локальний стан одразу
        setSchedule((prev) =>
          prev.map((entry) =>
            entry.id === editingEntry.id
              ? {
                  ...entry,
                  shift_start: shiftStart || undefined,
                  shift_end: shiftEnd || undefined,
                  status,
                }
              : entry
          )
        );
        
        toast.success('Зміну оновлено');
      } else {
        const response = await api.post('/schedule', {
          employee_id: selectedEmployeeId,
          kiosk_id: parseInt(selectedKioskId, 10),
          date: selectedDate,
          shift_start: shiftStart || null,
          shift_end: shiftEnd || null,
          status,
        });
        
        // Додаємо новий запис до локального стану одразу
        const newEntry: ScheduleEntry = {
          id: response.data.id,
          employee_id: selectedEmployeeId,
          employee_name: employees.find((e) => e.id === selectedEmployeeId)?.full_name || '',
          kiosk_id: parseInt(selectedKioskId, 10),
          kiosk_name: selectedKiosk?.name || '',
          date: selectedDate,
          shift_start: shiftStart || undefined,
          shift_end: shiftEnd || undefined,
          status,
        };
        
        setSchedule((prev) => [...prev, newEntry]);
        toast.success('Зміну додано');
      }
      closeModal();
    } catch (error: any) {
      console.error('Save schedule error:', error);
      toast.error(error.response?.data?.error || 'Помилка збереження графіка');
      // При помилці оновлюємо з сервера
      loadSchedule();
    }
  };

  const deleteEntry = async (entry: ScheduleEntry) => {
    if (!confirm('Видалити цю зміну?')) return;
    try {
      await api.delete(`/schedule/${entry.id}`);
      
      // Оновлюємо локальний стан одразу
      setSchedule((prev) => prev.filter((e) => e.id !== entry.id));
      
      toast.success('Зміну видалено');
      closeModal();
    } catch (e) {
      console.error('Delete schedule error:', e);
      toast.error('Помилка видалення зміни');
      // При помилці оновлюємо з сервера
      loadSchedule();
    }
  };

  const handleCopyShift = () => {
    if (!editingEntry && (!shiftStart || !shiftEnd)) {
      toast.error('Спочатку вкажіть час зміни');
      return;
    }
    setShowCopyModal(true);
    setCopyDays(new Set());
  };

  const copyShiftToDays = async () => {
    if (copyDays.size === 0) {
      toast.error('Виберіть хоча б один день');
      return;
    }
    if (!selectedEmployeeId || !selectedKioskId) {
      toast.error('Виберіть продавця та магазин');
      return;
    }

    setCopyingShift(true);
    try {
      const startTime = editingEntry ? editingEntry.shift_start : shiftStart;
      const endTime = editingEntry ? editingEntry.shift_end : shiftEnd;
      const shiftStatus = editingEntry ? editingEntry.status : status;

      let created = 0;
      let skipped = 0;

      for (const dateISO of copyDays) {
        // Перевіряємо чи вже є зміна на цей день
        const existing = schedule.find(
          (e) =>
            e.employee_id === selectedEmployeeId &&
            e.date === dateISO &&
            String(e.kiosk_id) === String(selectedKioskId)
        );

        if (existing) {
          skipped++;
          continue;
        }

        try {
          const response = await api.post('/schedule', {
            employee_id: selectedEmployeeId,
            kiosk_id: parseInt(selectedKioskId, 10),
            date: dateISO,
            shift_start: startTime || null,
            shift_end: endTime || null,
            status: shiftStatus,
          });

          // Додаємо до локального стану
          const newEntry: ScheduleEntry = {
            id: response.data.id,
            employee_id: selectedEmployeeId,
            employee_name: employees.find((e) => e.id === selectedEmployeeId)?.full_name || '',
            kiosk_id: parseInt(selectedKioskId, 10),
            kiosk_name: selectedKiosk?.name || '',
            date: dateISO,
            shift_start: startTime || undefined,
            shift_end: endTime || undefined,
            status: shiftStatus,
          };
          setSchedule((prev) => [...prev, newEntry]);
          created++;
        } catch (e) {
          console.error('Copy shift error:', e);
        }
      }

      toast.success(`Скопійовано: ${created}. Пропущено (вже існує): ${skipped}.`);
      setShowCopyModal(false);
      setCopyDays(new Set());
    } catch (e) {
      console.error('Copy shift error:', e);
      toast.error('Помилка копіювання зміни');
    } finally {
      setCopyingShift(false);
    }
  };

  const copyWeekToNext = async () => {
    if (copying) return;
    if (!confirm('Скопіювати поточний тиждень на наступний? Існуючі зміни на наступному тижні не будуть перезаписані.')) return;
    if (!selectedKioskId) {
      toast.error('Спочатку створіть ларьок і виберіть його');
      return;
    }

    setCopying(true);
    try {
      const nextWeekStart = addDays(weekStart, 7);
      const nextWeekEnd = addDays(weekEnd, 7);
      const nextRes = await api.get(
        `/schedule?startDate=${format(nextWeekStart, 'yyyy-MM-dd')}&endDate=${format(nextWeekEnd, 'yyyy-MM-dd')}`
      );
      const nextEntries: ScheduleEntry[] = Array.isArray(nextRes.data) ? nextRes.data : [];
      const nextSet = new Set(nextEntries.map((e) => `${e.employee_id}-${e.date}-${e.kiosk_id}`));

      const toCopy = schedule
        .filter((e) => {
          const d = new Date(e.date);
          if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return false;
          // copy only for current kiosk selection (lightweight start)
          return String(e.kiosk_id) === String(selectedKioskId);
        })
        .map((e) => {
          const newDate = format(addDays(new Date(e.date), 7), 'yyyy-MM-dd');
          return {
            employee_id: e.employee_id,
            kiosk_id: parseInt(selectedKioskId, 10),
            date: newDate,
            shift_start: normalizeTime(e.shift_start) || null,
            shift_end: normalizeTime(e.shift_end) || null,
            status: 'scheduled',
          };
        });

      let created = 0;
      let skipped = 0;

      for (const payload of toCopy) {
        const key = `${payload.employee_id}-${payload.date}-${payload.kiosk_id}`;
        if (nextSet.has(key)) {
          skipped++;
          continue;
        }
        try {
          await api.post('/schedule', payload);
          created++;
        } catch (e) {
          console.error('Copy item failed:', e);
        }
      }

      toast.success(`Скопійовано: ${created}. Пропущено (вже існує): ${skipped}.`);
    } catch (e) {
      console.error('Copy week error:', e);
      toast.error('Не вдалося скопіювати тиждень');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Графік роботи</h1>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div className="text-sm text-gray-600">
              {format(weekStart, 'dd.MM', { locale: uk })} – {format(weekEnd, 'dd.MM', { locale: uk })}
            </div>
            {selectedKioskId && employees.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-xs text-gray-600 font-medium">Заповненість:</span>
                <span className="text-sm font-bold text-gray-900">
                  {weekStats.filledDays}/{weekStats.totalDays} днів
                </span>
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      weekStats.percentage >= 80
                        ? 'bg-emerald-500'
                        : weekStats.percentage >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${weekStats.percentage}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700">{weekStats.percentage}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCurrentWeek(addDays(currentWeek, -7))} className="btn btn-secondary">
            ← Попередній
          </button>
          <button onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="btn btn-secondary">
            Наступний →
          </button>
          <button onClick={() => setCurrentWeek(new Date())} className="btn btn-primary">
            Сьогодні
          </button>
          <button onClick={copyWeekToNext} className="btn btn-secondary" disabled={copying || kiosks.length === 0}>
            {copying ? 'Копіюю…' : 'Копіювати → наступний'}
          </button>
        </div>
      </div>

      {/* Вибір магазину - помітна картка */}
      <div className="card bg-gradient-to-r from-primary-50 to-white border-2 border-primary-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              🏪
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Магазин / Ларьок</label>
              <select
                className="input !py-2.5 !h-11 !text-base font-semibold !bg-white !border-primary-300 focus:!border-primary-500 focus:!ring-primary-500"
                value={selectedKioskId}
                onChange={(e) => setSelectedKioskId(e.target.value)}
                disabled={kiosks.length === 0}
              >
                {kiosks.length === 0 ? (
                  <option value="">Спочатку створіть ларьок</option>
                ) : (
                  kiosks.map((k) => (
                    <option key={k.id} value={String(k.id)}>
                      {k.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            {selectedKiosk && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-primary-200">
                <span className="text-xs text-gray-500">Обрано:</span>
                <span className="text-sm font-semibold text-primary-700">{selectedKiosk.name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 uppercase">Шаблони змін:</span>
            {SHIFT_TEMPLATES.map((tpl) => (
              <span
                key={tpl.label}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-primary-700 border-2 border-primary-200 hover:border-primary-400 transition-colors"
              >
                {tpl.label}
              </span>
            ))}
            <span className="text-xs text-gray-500 italic">Натисни клітинку → вибери шаблон</span>
          </div>
        </div>
      </div>

      {/* Фільтр по продавцям та пошук */}
      <div className="card bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              👤
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Продавець</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Пошук по імені..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="input !py-2 !h-10 flex-1 !bg-white"
                />
                <select
                  className="input !py-2 !h-10 !bg-white !min-w-[180px]"
                  value={selectedEmployeeFilter}
                  onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                >
                  <option value="">Всі продавці</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
                {(employeeSearch || selectedEmployeeFilter) && (
                  <button
                    onClick={() => {
                      setEmployeeSearch('');
                      setSelectedEmployeeFilter('');
                    }}
                    className="btn btn-secondary !h-10 !px-4"
                    title="Очистити фільтри"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
          {filteredEmployees.length !== employees.length && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-blue-200">
              <span className="text-xs text-gray-600">Показано:</span>
              <span className="text-sm font-semibold text-blue-700">
                {filteredEmployees.length} з {employees.length}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card">

        {loading ? (
          <div className="text-center py-10 text-gray-600">Завантаження…</div>
        ) : kiosks.length === 0 ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
            Спочатку створіть <b>1 ларьок</b> (меню “Ларьки”), щоб можна було зберігати графік.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gradient-to-b from-gray-50 to-white border-b-2 border-gray-300">
                    <div className="flex items-center justify-between gap-3 px-3 py-3">
                      <span className="font-bold text-gray-800">Продавець</span>
                      <span className="text-xs text-gray-500 font-medium">год/тиж</span>
                    </div>
                  </th>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(new Date(), day);
                    return (
                      <th
                        key={day.toISOString()}
                        className={`text-center min-w-[150px] border-b-2 ${
                          isToday
                            ? 'bg-primary-100 border-primary-300'
                            : 'bg-gradient-to-b from-gray-50 to-white border-gray-300'
                        }`}
                      >
                        <div className="text-xs font-semibold text-gray-600 mb-1 uppercase">
                          {format(day, 'EEEE', { locale: uk })}
                        </div>
                        <div className={`font-bold ${isToday ? 'text-primary-700' : 'text-gray-900'}`}>
                          {format(day, 'dd.MM', { locale: uk })}
                        </div>
                        {isToday && (
                          <div className="mt-1 text-[10px] font-semibold text-primary-600">СЬОГОДНІ</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-500">
                      {employeeSearch || selectedEmployeeFilter
                        ? 'Не знайдено продавців за заданими фільтрами'
                        : 'Немає продавців'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                  const hours = hoursByEmployee.get(employee.id) || 0;
                  return (
                    <tr key={employee.id}>
                      <td className="sticky left-0 bg-white z-10 border-r-2 border-gray-200">
                        <div className="px-3 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 truncate mb-1">{employee.full_name}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">~40 год ціль</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-600">
                                {daysFilledByEmployee.get(employee.id) || 0}/7 днів
                              </span>
                            </div>
                            {/* Індикатор заповненості */}
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 transition-all duration-300"
                                style={{ width: `${((daysFilledByEmployee.get(employee.id) || 0) / 7) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${hoursBadgeClass(hours)}`}>
                              {hours.toFixed(1)} год
                            </span>
                            {daysFilledByEmployee.get(employee.id) === 7 && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                ✓ Повний
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateISO = format(day, 'yyyy-MM-dd');
                        const isToday = isSameDay(new Date(), day);
                        const entries = (scheduleMap.get(`${employee.id}-${dateISO}`) || []).filter(
                          (e) => String(e.kiosk_id) === String(selectedKioskId)
                        );

                        const hasEntry = entries.length > 0;
                        return (
                          <td
                            key={day.toISOString()}
                            className={`align-top p-2 relative ${
                              isToday ? 'bg-primary-50/50 border-l-2 border-l-primary-400' : ''
                            } ${hasEntry ? 'bg-emerald-50/30' : ''}`}
                          >
                            {!hasEntry ? (
                              <button
                                type="button"
                                onClick={() => openCreate(employee.id, dateISO)}
                                className="w-full h-[80px] rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:text-primary-600 hover:border-primary-400 hover:bg-primary-50/60 transition-all flex flex-col items-center justify-center gap-1 group"
                                title="Додати зміну"
                              >
                                <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
                                <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Додати</span>
                              </button>
                            ) : (
                              <div className="space-y-2">
                                {entries.map((entry) => {
                                  const duration = calcShiftHours(entry.shift_start, entry.shift_end);
                                  const isActive = entry.status === 'started';
                                  return (
                                    <button
                                      key={entry.id}
                                      type="button"
                                      onClick={() => openEdit(entry)}
                                      className={`w-full text-left rounded-xl border-2 transition-all p-3 shadow-sm ${
                                        isActive
                                          ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 border-emerald-300 hover:from-emerald-200 hover:to-emerald-100'
                                          : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:from-gray-50 hover:to-white hover:border-primary-300'
                                      }`}
                                      title="Натисни, щоб редагувати"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            {isActive && (
                                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                            <div className="font-bold text-gray-900">
                                              {entry.shift_start && entry.shift_end
                                                ? `${normalizeTime(entry.shift_start)}–${normalizeTime(entry.shift_end)}`
                                                : 'Без часу'}
                                            </div>
                                          </div>
                                          <div className="text-xs text-gray-600 font-medium">
                                            {duration > 0 ? `${duration.toFixed(1)} год` : '—'}
                                          </div>
                                        </div>
                                        <span
                                          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold ${getStatusColor(entry.status)} border`}
                                        >
                                          {getStatusLabel(entry.status)}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {/* Індикатор що день заповнений */}
                            {hasEntry && (
                              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white shadow-sm" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold">{editingEntry ? 'Редагувати зміну' : 'Додати зміну'}</h2>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedDate ? format(new Date(selectedDate), 'dd.MM.yyyy (EEEE)', { locale: uk }) : ''}
                </div>
              </div>
              <button type="button" onClick={closeModal} className="text-gray-500 hover:text-gray-800 text-xl leading-none">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {SHIFT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary-50 to-white text-primary-700 border border-primary-100 hover:border-primary-200 hover:bg-primary-50/60 transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Продавець</label>
                <select
                  className="input"
                  value={selectedEmployeeId ?? ''}
                  onChange={(e) => setSelectedEmployeeId(parseInt(e.target.value, 10))}
                  disabled={!!editingEntry}
                >
                  <option value="">Виберіть продавця</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
                {editingEntry && <div className="text-xs text-gray-500 mt-1">Для редагування змінюємо час/статус.</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Початок</label>
                  <input type="time" className="input" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Кінець</label>
                  <input type="time" className="input" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  Тривалість:{' '}
                  <span className="font-semibold text-gray-900">{calcShiftHours(shiftStart, shiftEnd).toFixed(1)} год</span>
                </div>
                <div className="w-44">
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="scheduled">Заплановано</option>
                    <option value="started">На зміні</option>
                    <option value="completed">Завершено</option>
                    <option value="absent">Відсутній</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                {editingEntry && (
                  <>
                    <button type="button" onClick={() => deleteEntry(editingEntry)} className="btn btn-secondary">
                      Видалити
                    </button>
                    <button type="button" onClick={handleCopyShift} className="btn btn-secondary">
                      📋 Копіювати
                    </button>
                  </>
                )}
                {!editingEntry && (shiftStart || shiftEnd) && (
                  <button type="button" onClick={handleCopyShift} className="btn btn-secondary">
                    📋 Копіювати на інші дні
                  </button>
                )}
                <button type="button" onClick={saveEntry} className="btn btn-primary flex-1">
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальне вікно для копіювання зміни */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold">Копіювати зміну</h2>
                <div className="text-sm text-gray-600 mt-1">
                  Виберіть дні тижня для копіювання
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCopyModal(false);
                  setCopyDays(new Set());
                }}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {weekDays.map((day) => {
                  const dateISO = format(day, 'yyyy-MM-dd');
                  const isSelected = copyDays.has(dateISO);
                  const isToday = isSameDay(new Date(), day);
                  const hasExisting = schedule.some(
                    (e) =>
                      e.employee_id === selectedEmployeeId &&
                      e.date === dateISO &&
                      String(e.kiosk_id) === String(selectedKioskId)
                  );

                  return (
                    <button
                      key={dateISO}
                      type="button"
                      onClick={() => {
                        const newSet = new Set(copyDays);
                        if (newSet.has(dateISO)) {
                          newSet.delete(dateISO);
                        } else {
                          newSet.add(dateISO);
                        }
                        setCopyDays(newSet);
                      }}
                      disabled={hasExisting}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-primary-100 border-primary-500 text-primary-900'
                          : hasExisting
                          ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                          : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                      } ${isToday ? 'ring-2 ring-primary-400' : ''}`}
                    >
                      <div className="font-semibold text-sm">
                        {format(day, 'EEEE', { locale: uk })}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {format(day, 'dd.MM', { locale: uk })}
                      </div>
                      {hasExisting && (
                        <div className="text-[10px] text-gray-400 mt-1">Вже є зміна</div>
                      )}
                      {isSelected && (
                        <div className="text-[10px] text-primary-700 font-semibold mt-1">✓ Обрано</div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCopyModal(false);
                    setCopyDays(new Set());
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={copyShiftToDays}
                  disabled={copyDays.size === 0 || copyingShift}
                  className="btn btn-primary flex-1"
                >
                  {copyingShift ? 'Копіюю...' : `Копіювати (${copyDays.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

