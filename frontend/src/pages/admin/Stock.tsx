import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';

type LowStockItem = {
  id: number;
  name: string;
  brand?: string;
  type?: string;
  kiosk_id: number;
  kiosk_name?: string;
  quantity: number;
  low_stock_threshold: number;
  target_stock_level: number;
  auto_reorder: boolean;
  recommended_qty: number;
  alert_id?: number | null;
  alert_triggered_at?: string | null;
};

type PurchaseOrderItem = {
  id: number;
  product_id: number;
  name?: string;
  brand?: string;
  type?: string;
  current_qty: number;
  threshold: number;
  target_level: number;
  recommended_qty: number;
};

type PurchaseOrder = {
  id: number;
  kiosk_id: number;
  kiosk_name?: string;
  status: 'draft' | 'confirmed' | 'cancelled' | 'received';
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItem[];
};

export function Stock() {
  const [loading, setLoading] = useState(true);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [kioskId, setKioskId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'low' | 'orders'>('low');
  const [lowItems, setLowItems] = useState<LowStockItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    loadKiosks();
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kioskId]);

  const loadKiosks = async () => {
    try {
      const res = await api.get('/kiosks');
      setKiosks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Load kiosks error:', e);
      setKiosks([]);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (kioskId) params.append('kiosk_id', kioskId);

      const [lowRes, ordersRes] = await Promise.all([
        api.get(`/stock/low?${params.toString()}`),
        api.get(`/stock/orders?status=draft&${params.toString()}`),
      ]);

      setLowItems(Array.isArray(lowRes.data?.items) ? lowRes.data.items : []);
      setOrders(Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders : []);
    } catch (e: any) {
      console.error('Load stock page error:', e);
      toast.error('Помилка завантаження даних складу');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const affectedKiosks = new Set(lowItems.map((x) => x.kiosk_id)).size;
    const totalRecommended = lowItems.reduce((sum, x) => sum + (Number(x.recommended_qty) || 0), 0);
    const draftOrders = orders.length;
    const draftItems = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
    return { affectedKiosks, totalRecommended, draftOrders, draftItems };
  }, [lowItems, orders]);

  const resolveAlert = async (alertId: number) => {
    try {
      await api.post(`/stock/alerts/${alertId}/resolve`);
      toast.success('Алерт закрито');
      loadAll();
    } catch (e) {
      console.error('Resolve alert error:', e);
      toast.error('Не вдалося закрити алерт');
    }
  };

  const confirmOrder = async (orderId: number) => {
    try {
      await api.post(`/stock/orders/${orderId}/confirm`);
      toast.success('Замовлення підтверджено');
      loadAll();
    } catch (e) {
      console.error('Confirm order error:', e);
      toast.error('Не вдалося підтвердити замовлення');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Низькі залишки / Авто-замовлення</h2>
          <p className="text-sm text-gray-600 mt-1">
            Система показує товари нижче порогу і формує чернетки замовлень (якщо увімкнено авто-замовлення в товарі).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={kioskId}
            onChange={(e) => setKioskId(e.target.value)}
            className="input"
          >
            <option value="">Всі ларьки</option>
            {kiosks.map((k) => (
              <option key={k.id} value={String(k.id)}>
                {k.name}
              </option>
            ))}
          </select>
          <button
            onClick={loadAll}
            className="btn btn-secondary"
          >
            Оновити
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500">Низьких товарів</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{lowItems.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Ларьків з проблемою</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.affectedKiosks}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Рекоменд. поповнення (шт.)</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRecommended}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Чернеток замовлень</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.draftOrders}</div>
          <div className="text-xs text-gray-500 mt-1">Позицій: {stats.draftItems}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`btn ${activeTab === 'low' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('low')}
          >
            Низькі залишки
          </button>
          <button
            className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('orders')}
          >
            Чернетки замовлень
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="text-gray-600">Завантаження…</div>
        </div>
      ) : activeTab === 'low' ? (
        <div className="card overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Ларьок</th>
                <th className="px-4 py-3 font-semibold">Товар</th>
                <th className="px-4 py-3 font-semibold text-right">Залишок</th>
                <th className="px-4 py-3 font-semibold text-right">Поріг</th>
                <th className="px-4 py-3 font-semibold text-right">Ціль</th>
                <th className="px-4 py-3 font-semibold text-right">Рекоменд.</th>
                <th className="px-4 py-3 font-semibold">Авто</th>
                <th className="px-4 py-3 font-semibold text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lowItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={8}>
                    Немає товарів з низьким залишком.
                  </td>
                </tr>
              ) : (
                lowItems.map((x) => (
                  <tr key={x.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{x.kiosk_name || `#${x.kiosk_id}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{x.name}</div>
                      <div className="text-xs text-gray-500">{[x.brand, x.type].filter(Boolean).join(' • ')}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700 whitespace-nowrap">{x.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{x.low_stock_threshold}</td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{x.target_stock_level}</td>
                    <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">{x.recommended_qty}</td>
                    <td className="px-4 py-3">
                      {x.auto_reorder ? (
                        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">ON</span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-semibold">OFF</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {x.alert_id ? (
                        <button
                          className="btn btn-secondary"
                          onClick={() => resolveAlert(Number(x.alert_id))}
                        >
                          Закрити алерт
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="card">
              <div className="text-gray-500">Немає чернеток замовлень.</div>
            </div>
          ) : (
            orders.map((o) => {
              const totalRecommended = (o.items || []).reduce((sum, it) => sum + (Number(it.recommended_qty) || 0), 0);
              return (
                <div key={o.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        Замовлення #{o.id} • {o.kiosk_name || `#${o.kiosk_id}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Статус: <span className="font-semibold">{o.status}</span> • Позицій: {o.items?.length || 0} • Рекоменд.: {totalRecommended} шт.
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => confirmOrder(o.id)}
                    >
                      Підтвердити
                    </button>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[860px] w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-gray-600">
                          <th className="px-4 py-3 font-semibold">Товар</th>
                          <th className="px-4 py-3 font-semibold text-right">Залишок</th>
                          <th className="px-4 py-3 font-semibold text-right">Поріг</th>
                          <th className="px-4 py-3 font-semibold text-right">Ціль</th>
                          <th className="px-4 py-3 font-semibold text-right">Рекоменд.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(o.items || []).map((it) => (
                          <tr key={it.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{it.name || `#${it.product_id}`}</div>
                              <div className="text-xs text-gray-500">{[it.brand, it.type].filter(Boolean).join(' • ')}</div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{it.current_qty}</td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{it.threshold}</td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{it.target_level}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{it.recommended_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}


