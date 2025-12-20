import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Inventory {
  id: number;
  kiosk_id: number;
  kiosk_name?: string;
  created_by?: number;
  created_by_name?: string;
  status: 'draft' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  completed_at?: string;
  items_count?: number;
  discrepancies_count?: number;
  items?: InventoryItem[];
}

interface InventoryItem {
  id: number;
  product_id: number;
  product_name?: string;
  brand?: string;
  type?: string;
  price?: number;
  system_quantity: number;
  actual_quantity?: number | null;
  difference?: number | null;
  notes?: string;
}

export function Inventory() {
  const [loading, setLoading] = useState(true);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedKioskId, setSelectedKioskId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Check if completed inventory can still be edited (within 2 hours)
  const canEditCompleted = (inventory: Inventory): boolean => {
    if (inventory.status !== 'completed' || !inventory.completed_at) return false;
    const completedAt = new Date(inventory.completed_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 2;
  };

  // Get remaining time for editing completed inventory
  const getRemainingEditTime = (inventory: Inventory): string | null => {
    if (inventory.status !== 'completed' || !inventory.completed_at) return null;
    const completedAt = new Date(inventory.completed_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 2) return null;
    const remainingHours = 2 - hoursDiff;
    const minutes = Math.floor((remainingHours % 1) * 60);
    const hours = Math.floor(remainingHours);
    if (hours > 0) {
      return `${hours} год ${minutes} хв`;
    }
    return `${minutes} хв`;
  };

  useEffect(() => {
    loadKiosks();
    loadInventories();
  }, []);

  useEffect(() => {
    loadInventories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(updateTimerRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const loadKiosks = async () => {
    try {
      const res = await api.get('/kiosks');
      setKiosks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Load kiosks error:', e);
      setKiosks([]);
    }
  };

  const loadInventories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);

      const res = await api.get(`/inventory?${params.toString()}`);
      setInventories(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error('Load inventories error:', e);
      toast.error('Помилка завантаження інвентаризацій');
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryDetails = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/inventory/${id}`);
      setSelectedInventory(res.data);
    } catch (e: any) {
      console.error('Load inventory details error:', e);
      toast.error('Помилка завантаження деталей інвентаризації');
    }
  }, []);

  const handleCreateInventory = async () => {
    if (!selectedKioskId) {
      toast.error('Оберіть ларьок');
      return;
    }

    try {
      const res = await api.post('/inventory', {
        kiosk_id: parseInt(selectedKioskId),
        notes: notes || null,
      });

      toast.success('Інвентаризація створена');
      setShowCreateModal(false);
      setSelectedKioskId('');
      setNotes('');
      await loadInventoryDetails(res.data.id);
      await loadInventories();
    } catch (e: any) {
      console.error('Create inventory error:', e);
      toast.error(e.response?.data?.error || 'Помилка створення інвентаризації');
    }
  };

  // Debounce timer ref
  const updateTimerRef = useRef<{ [key: number]: NodeJS.Timeout }>({});

  const handleUpdateItem = useCallback(async (inventoryId: number, itemId: number, actualQuantity: number | null) => {
    // Optimistic update
    setSelectedInventory(prev => {
      if (!prev || prev.id !== inventoryId) return prev;
      
      const updatedItems = prev.items?.map(item => {
        if (item.id === itemId) {
          const parsedQty = actualQuantity !== null ? parseInt(String(actualQuantity)) : null;
          const diff = parsedQty !== null ? parsedQty - item.system_quantity : null;
          return {
            ...item,
            actual_quantity: parsedQty,
            difference: diff,
          };
        }
        return item;
      });

      return {
        ...prev,
        items: updatedItems,
      };
    });

    // Clear existing timer for this item
    if (updateTimerRef.current[itemId]) {
      clearTimeout(updateTimerRef.current[itemId]);
    }

    // Debounce API call
    updateTimerRef.current[itemId] = setTimeout(async () => {
      try {
        await api.put(`/inventory/${inventoryId}/items/${itemId}`, {
          actual_quantity: actualQuantity !== null ? parseInt(String(actualQuantity)) : null,
        });

        // Silently reload to sync with server (no toast, no error notification)
        const res = await api.get(`/inventory/${inventoryId}`);
        setSelectedInventory(res.data);
      } catch (e: any) {
        console.error('Update item error:', e);
        // Only show error toast, reload to revert optimistic update
        toast.error(e.response?.data?.error || 'Помилка оновлення');
        loadInventoryDetails(inventoryId);
      } finally {
        delete updateTimerRef.current[itemId];
      }
    }, 500); // 500ms debounce
  }, [loadInventoryDetails]);

  const handleCompleteInventory = async (id: number) => {
    const inventory = selectedInventory;
    const isRecompleting = inventory?.status === 'completed';
    
    const message = isRecompleting
      ? 'Підтвердити збереження змін? Залишки будуть оновлені відповідно до нових фактичних значень.'
      : 'Підтвердити завершення інвентаризації? Залишки будуть оновлені відповідно до фактичних значень.';
    
    if (!confirm(message)) {
      return;
    }

    try {
      await api.post(`/inventory/${id}/complete`);
      toast.success(isRecompleting ? 'Зміни збережено, залишки оновлено' : 'Інвентаризація завершена, залишки оновлено');
      await loadInventoryDetails(id);
      await loadInventories();
    } catch (e: any) {
      console.error('Complete inventory error:', e);
      toast.error(e.response?.data?.error || 'Помилка завершення інвентаризації');
    }
  };

  const handleCancelInventory = async (id: number) => {
    if (!confirm('Скасувати інвентаризацію?')) {
      return;
    }

    try {
      await api.post(`/inventory/${id}/cancel`);
      toast.success('Інвентаризація скасована');
      await loadInventories();
      if (selectedInventory?.id === id) {
        setSelectedInventory(null);
      }
    } catch (e: any) {
      console.error('Cancel inventory error:', e);
      toast.error(e.response?.data?.error || 'Помилка скасування інвентаризації');
    }
  };

  const handleDeleteInventory = async (id: number) => {
    if (!confirm('Видалити інвентаризацію?')) {
      return;
    }

    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Інвентаризація видалена');
      await loadInventories();
      if (selectedInventory?.id === id) {
        setSelectedInventory(null);
      }
    } catch (e: any) {
      console.error('Delete inventory error:', e);
      toast.error(e.response?.data?.error || 'Помилка видалення інвентаризації');
    }
  };

  if (loading && inventories.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Завантаження...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Інвентаризація</h1>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
          >
            <option value="">Всі статуси</option>
            <option value="draft">Чернетки</option>
            <option value="completed">Завершені</option>
            <option value="cancelled">Скасовані</option>
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            + Створити інвентаризацію
          </button>
        </div>
      </div>

      {/* Inventories List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ларьок</th>
                <th>Статус</th>
                <th>Товарів</th>
                <th>Розбіжностей</th>
                <th>Створено</th>
                <th>Автор</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Немає інвентаризацій
                  </td>
                </tr>
              ) : (
                inventories.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-semibold">#{inv.id}</td>
                    <td>{inv.kiosk_name || '—'}</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          inv.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : inv.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {inv.status === 'completed'
                          ? 'Завершена'
                          : inv.status === 'cancelled'
                          ? 'Скасована'
                          : 'Чернетка'}
                      </span>
                    </td>
                    <td>{inv.items_count || 0}</td>
                    <td>
                      {inv.discrepancies_count ? (
                        <span className="text-red-600 font-semibold">
                          {inv.discrepancies_count}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td>
                      {format(new Date(inv.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                    </td>
                    <td>{inv.created_by_name || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadInventoryDetails(inv.id)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Відкрити
                        </button>
                        {inv.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleCancelInventory(inv.id)}
                              className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                            >
                              Скасувати
                            </button>
                            <button
                              onClick={() => handleDeleteInventory(inv.id)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Видалити
                            </button>
                          </>
                        )}
                        {inv.status === 'completed' && inv.completed_at && (() => {
                          const completedAt = new Date(inv.completed_at);
                          const now = new Date();
                          const hoursDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
                          return hoursDiff <= 2 ? (
                            <button
                              onClick={() => handleCancelInventory(inv.id)}
                              className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                              title="Можна скасувати протягом 2 годин"
                            >
                              Скасувати
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Inventory Details */}
      {selectedInventory && (
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Інвентаризація #{selectedInventory.id}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedInventory.kiosk_name} •{' '}
                {format(new Date(selectedInventory.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
              </p>
            </div>
            <button
              onClick={() => setSelectedInventory(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {selectedInventory.notes && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700">{selectedInventory.notes}</p>
            </div>
          )}

          {selectedInventory.items && selectedInventory.items.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Системна кількість</th>
                      <th>Фактична кількість</th>
                      <th>Різниця</th>
                      <th>Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInventory.items.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.difference && item.difference !== 0
                            ? 'bg-red-50'
                            : item.actual_quantity !== null
                            ? 'bg-green-50'
                            : ''
                        }
                      >
                        <td>
                          <div>
                            <div className="font-medium">{item.product_name}</div>
                            {item.brand && (
                              <div className="text-sm text-gray-500">{item.brand}</div>
                            )}
                          </div>
                        </td>
                        <td className="font-semibold">{item.system_quantity}</td>
                        <td>
                          {(selectedInventory.status === 'draft' || canEditCompleted(selectedInventory)) ? (
                            <input
                              type="number"
                              min="0"
                              value={item.actual_quantity ?? ''}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                const value = inputValue === '' ? null : (isNaN(parseInt(inputValue)) ? null : parseInt(inputValue));
                                if (value !== null && value < 0) return; // Prevent negative values
                                handleUpdateItem(selectedInventory.id, item.id, value);
                              }}
                              onBlur={(e) => {
                                // Ensure value is saved on blur
                                const value = e.target.value === '' ? null : parseInt(e.target.value);
                                if (value !== null && value < 0) return;
                                handleUpdateItem(selectedInventory.id, item.id, value);
                              }}
                              className="input w-24"
                              placeholder="—"
                              disabled={selectedInventory.status === 'cancelled'}
                            />
                          ) : (
                            <span className="font-semibold">
                              {item.actual_quantity !== null ? item.actual_quantity : '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {item.difference !== null && item.difference !== 0 ? (
                            <span
                              className={`font-semibold ${
                                item.difference > 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {item.difference > 0 ? '+' : ''}
                              {item.difference}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td>
                          {(selectedInventory.status === 'draft' || canEditCompleted(selectedInventory)) && (
                            <button
                              onClick={() => handleUpdateItem(selectedInventory.id, item.id, null)}
                              className="text-sm text-gray-600 hover:text-gray-700"
                            >
                              Очистити
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(selectedInventory.status === 'draft' || canEditCompleted(selectedInventory)) && (
                <div className="flex justify-end gap-2 items-center">
                  {selectedInventory.status === 'completed' && canEditCompleted(selectedInventory) && (
                    <div className="flex-1 text-sm text-amber-600">
                      ⚠️ Можна редагувати ще {getRemainingEditTime(selectedInventory)}
                    </div>
                  )}
                  <button
                    onClick={() => handleCancelInventory(selectedInventory.id)}
                    className="btn btn-secondary"
                  >
                    {selectedInventory.status === 'completed' ? 'Скасувати та відкотити' : 'Скасувати'}
                  </button>
                  {selectedInventory.status === 'draft' && (
                    <button
                      onClick={() => handleCompleteInventory(selectedInventory.id)}
                      className="btn btn-primary"
                    >
                      Завершити інвентаризацію
                    </button>
                  )}
                  {selectedInventory.status === 'completed' && canEditCompleted(selectedInventory) && (
                    <button
                      onClick={() => handleCompleteInventory(selectedInventory.id)}
                      className="btn btn-primary"
                    >
                      Зберегти зміни
                    </button>
                  )}
                </div>
              )}

              {selectedInventory.status === 'completed' && selectedInventory.completed_at && (
                <div className="text-sm text-gray-500 text-right">
                  Завершено:{' '}
                  {format(new Date(selectedInventory.completed_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Немає товарів в інвентаризації
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Створити інвентаризацію</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ларьок *</label>
                <select
                  value={selectedKioskId}
                  onChange={(e) => setSelectedKioskId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Оберіть ларьок</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={String(kiosk.id)}>
                      {kiosk.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Примітки</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Додаткові примітки..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedKioskId('');
                  setNotes('');
                }}
                className="btn btn-secondary"
              >
                Скасувати
              </button>
              <button onClick={handleCreateInventory} className="btn btn-primary">
                Створити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

