import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';

interface Kiosk {
  id: number;
  name: string;
  address: string;
  stats?: {
    products: { total: number; total_quantity: number };
    sales: { total_sales: number; total_revenue: number; total_commission: number };
  };
  employees?: any[];
}

export function Kiosks() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [selectedKiosk, setSelectedKiosk] = useState<Kiosk | null>(null);

  useEffect(() => {
    loadKiosks();
  }, []);

  const loadKiosks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/kiosks');
      const kiosksWithStats = await Promise.all(
        response.data.map(async (kiosk: Kiosk) => {
          try {
            const statsResponse = await api.get(`/kiosks/${kiosk.id}`);
            return statsResponse.data;
          } catch {
            return kiosk;
          }
        })
      );
      setKiosks(kiosksWithStats);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цей ларьок?')) return;

    try {
      await api.delete(`/kiosks/${id}`);
      loadKiosks();
    } catch (error) {
      alert('Помилка видалення ларька');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      address: formData.get('address'),
    };

    try {
      if (editingKiosk) {
        await api.put(`/kiosks/${editingKiosk.id}`, data);
      } else {
        await api.post('/kiosks', data);
      }
      setShowModal(false);
      setEditingKiosk(null);
      loadKiosks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Помилка збереження ларька');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Ларьки</h1>
        <button
          onClick={() => {
            setEditingKiosk(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Додати ларьок
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">Завантаження...</div>
        ) : (
          kiosks.map((kiosk) => (
            <div key={kiosk.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{kiosk.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{kiosk.address}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingKiosk(kiosk);
                      setShowModal(true);
                    }}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Редагувати
                  </button>
                  <button
                    onClick={() => handleDelete(kiosk.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Видалити
                  </button>
                </div>
              </div>

              {kiosk.stats && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Товарів:</span>
                    <span className="font-medium">{kiosk.stats.products?.total || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Наявність:</span>
                    <span className="font-medium">
                      {kiosk.stats.products?.total_quantity || 0} шт.
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Продажів:</span>
                    <span className="font-medium">
                      {kiosk.stats.sales?.total_sales || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Виручка:</span>
                    <span className="font-semibold text-green-600">
                      {parseFloat(kiosk.stats.sales?.total_revenue || 0).toFixed(2)} ₴
                    </span>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Link
                  to={`/sales?kiosk_id=${String(kiosk.id)}`}
                  className="btn btn-secondary text-sm flex-1 text-center"
                >
                  Продажі
                </Link>
                <button
                  onClick={() => setSelectedKiosk(kiosk)}
                  className="btn btn-secondary text-sm flex-1"
                >
                  Деталі
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingKiosk ? 'Редагувати ларьок' : 'Додати ларьок'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Назва *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingKiosk?.name}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Адреса *</label>
                <textarea
                  name="address"
                  defaultValue={editingKiosk?.address}
                  className="input"
                  rows={3}
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="btn btn-primary flex-1">
                  Зберегти
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingKiosk(null);
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

      {/* Details Modal */}
      {selectedKiosk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedKiosk.name}</h2>
              <button
                onClick={() => setSelectedKiosk(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Адреса</h3>
                <p className="text-gray-600">{selectedKiosk.address}</p>
              </div>
              {selectedKiosk.stats && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Статистика</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600">Товарів</div>
                        <div className="text-xl font-bold">
                          {selectedKiosk.stats.products?.total || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600">Наявність</div>
                        <div className="text-xl font-bold">
                          {selectedKiosk.stats.products?.total_quantity || 0} шт.
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600">Продажів</div>
                        <div className="text-xl font-bold">
                          {selectedKiosk.stats.sales?.total_sales || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600">Виручка</div>
                        <div className="text-xl font-bold text-green-600">
                          {parseFloat(selectedKiosk.stats.sales?.total_revenue || 0).toFixed(2)} ₴
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {selectedKiosk.employees && selectedKiosk.employees.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Продавці</h3>
                  <div className="space-y-2">
                    {selectedKiosk.employees.map((emp) => (
                      <div key={emp.id} className="p-2 bg-gray-50 rounded">
                        {emp.full_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

