import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';

interface Employee {
  id: number;
  username: string;
  full_name: string;
  kiosk_id?: number;
  kiosk_name?: string;
  sales_today?: number;
  commission_today?: number;
}

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadKiosks();
    loadEmployees();
  }, []);

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цього продавця?')) return;

    try {
      await api.delete(`/employees/${id}`);
      loadEmployees();
    } catch (error) {
      alert('Помилка видалення продавця');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {
      username: formData.get('username'),
      full_name: formData.get('full_name'),
      kiosk_id: formData.get('kiosk_id') ? parseInt(formData.get('kiosk_id') as string) : null,
    };

    if (!editingEmployee) {
      data.password = formData.get('password');
    } else if (formData.get('password')) {
      data.password = formData.get('password');
    }

    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, data);
      } else {
        await api.post('/employees', data);
      }
      setShowModal(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка збереження продавця');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Продавці</h1>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Додати продавця
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-12">Завантаження...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ПІБ</th>
                  <th>Логін</th>
                  <th>Ларьок</th>
                  <th>Продажів за день</th>
                  <th>Зарплата (12%)</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-medium">{employee.full_name}</td>
                    <td>{employee.username}</td>
                    <td>{employee.kiosk_name || '-'}</td>
                    <td>{employee.sales_today || 0}</td>
                    <td className="font-semibold text-purple-600">
                      {parseFloat(String(employee.commission_today || 0)).toFixed(2)} ₴
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <Link
                          to={`/sales?seller_id=${String(employee.id)}`}
                          className="text-primary-600 hover:text-primary-700 text-sm"
                        >
                          Статистика
                        </Link>
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setShowModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-700 text-sm"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Видалити
                        </button>
                      </div>
                    </td>
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
            <h2 className="text-xl font-bold mb-4">
              {editingEmployee ? 'Редагувати продавця' : 'Додати продавця'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ПІБ *</label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={editingEmployee?.full_name}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Логін *</label>
                <input
                  type="text"
                  name="username"
                  defaultValue={editingEmployee?.username}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Пароль {editingEmployee ? '(залиште порожнім, щоб не змінювати)' : '*'}
                </label>
                <input
                  type="password"
                  name="password"
                  className="input"
                  required={!editingEmployee}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ларьок</label>
                <select
                  name="kiosk_id"
                  defaultValue={editingEmployee?.kiosk_id || ''}
                  className="input"
                >
                  <option value="">Не призначено</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={String(kiosk.id)}>
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
                    setEditingEmployee(null);
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

