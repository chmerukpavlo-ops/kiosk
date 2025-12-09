import { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { format } from 'date-fns';
import { toast } from '../../components/Toast';

interface Product {
  id: number;
  name: string;
  brand?: string;
  type?: string;
  price: number | string;
  quantity: number;
  kiosk_id: number;
  kiosk_name?: string;
  status: string;
}

interface ImportProduct {
  name: string;
  brand?: string;
  type?: string;
  price: number;
  quantity: number;
  kiosk_id: number;
  status: string;
  errors?: string[];
}

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importPreview, setImportPreview] = useState<ImportProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    id: true,
    name: true,
    brand: true,
    type: true,
    kiosk_name: true,
    quantity: true,
    price: true,
    status: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState({
    search: '',
    brand: '',
    type: '',
    kiosk_id: '',
    status: '',
  });

  useEffect(() => {
    loadKiosks();
    loadProducts();
  }, [filters]);

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(response.data);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.type) params.append('type', filters.type);
      if (filters.kiosk_id) params.append('kiosk_id', String(filters.kiosk_id));
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/products?${params.toString()}`);
      setProducts(response.data || []);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      setProducts([]);
      if (error.response?.status === 403 || error.response?.status === 401) {
        toast.error('Немає доступу до цієї сторінки');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цей товар?')) return;

    try {
      await api.delete(`/products/${id}`);
      toast.success('Товар успішно видалено');
      loadProducts();
    } catch (error) {
      toast.error('Помилка видалення товару');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      brand: formData.get('brand'),
      type: formData.get('type'),
      price: parseFloat(formData.get('price') as string),
      quantity: parseInt(formData.get('quantity') as string),
      kiosk_id: parseInt(formData.get('kiosk_id') as string),
      status: formData.get('status'),
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, data);
        toast.success('Товар успішно оновлено');
      } else {
        await api.post('/products', data);
        toast.success('Товар успішно додано');
      }
      setShowModal(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка збереження товару');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());
        
        if (lines.length < 2) {
          toast.error('CSV файл повинен містити заголовки та хоча б один рядок даних');
          return;
        }

        // Парсинг заголовків
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const requiredHeaders = ['назва', 'ціна', 'кількість', 'ларьок'];
        const missingHeaders = requiredHeaders.filter(
          (h) => !headers.includes(h) && !headers.includes(h.replace('ь', 'и'))
        );

        if (missingHeaders.length > 0) {
          toast.error(`Відсутні обов'язкові колонки: ${missingHeaders.join(', ')}`);
          return;
        }

        // Парсинг даних
        const parsed: ImportProduct[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim());
          const row: any = { errors: [] };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            
            if (header.includes('назва') || header === 'name') {
              row.name = value;
            } else if (header.includes('бренд') || header === 'brand') {
              row.brand = value || undefined;
            } else if (header.includes('тип') || header === 'type') {
              row.type = value || undefined;
            } else if (header.includes('ціна') || header === 'price') {
              row.price = parseFloat(value) || 0;
            } else if (header.includes('кількість') || header.includes('quantity')) {
              row.quantity = parseInt(value) || 0;
            } else if (header.includes('лар') || header === 'kiosk') {
              // Знаходимо ларьок за назвою
              const kiosk = kiosks.find((k) => k.name.toLowerCase() === value.toLowerCase());
              if (kiosk) {
                row.kiosk_id = kiosk.id;
              } else {
                row.errors?.push(`Ларьок "${value}" не знайдено`);
              }
            } else if (header.includes('статус') || header === 'status') {
              row.status = value === 'out_of_stock' ? 'out_of_stock' : 'available';
            }
          });

          // Валідація
          if (!row.name) row.errors?.push('Назва обов\'язкова');
          if (!row.price || row.price <= 0) row.errors?.push('Ціна повинна бути більше 0');
          if (row.quantity === undefined || row.quantity < 0) row.errors?.push('Кількість не може бути від\'ємною');
          if (!row.kiosk_id) row.errors?.push('Ларьок обов\'язковий');

          if (row.errors && row.errors.length > 0) {
            errors.push(`Рядок ${i + 1}: ${row.errors.join(', ')}`);
          }

          parsed.push(row as ImportProduct);
        }

        if (errors.length > 0) {
          toast.error(`Знайдено помилки в ${errors.length} рядках. Перевірте прев'ю.`);
        }

        setImportPreview(parsed);
        setShowImportModal(true);
      } catch (error) {
        toast.error('Помилка читання CSV файлу');
        console.error(error);
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    try {
      const validProducts = importPreview.filter((p) => !p.errors || p.errors.length === 0);
      
      if (validProducts.length === 0) {
        toast.error('Немає валідних товарів для імпорту');
        setImporting(false);
        return;
      }

      // Масове додавання товарів
      const promises = validProducts.map((product) =>
        api.post('/products', {
          name: product.name,
          brand: product.brand,
          type: product.type,
          price: product.price,
          quantity: product.quantity,
          kiosk_id: product.kiosk_id,
          status: product.status || 'available',
        })
      );

      await Promise.all(promises);
      toast.success(`Успішно імпортовано ${validProducts.length} товарів`);
      setShowImportModal(false);
      setImportPreview([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка імпорту товарів');
    } finally {
      setImporting(false);
    }
  };

  const handleExportProducts = () => {
    if (products.length === 0) {
      toast.error('Немає товарів для експорту');
      return;
    }

    const selectedColumns = Object.entries(exportColumns)
      .filter(([_, selected]) => selected)
      .map(([key]) => key);

    const headers: string[] = [];
    const headerMap: Record<string, string> = {
      id: 'ID',
      name: 'Назва',
      brand: 'Бренд',
      type: 'Тип',
      kiosk_name: 'Ларьок',
      quantity: 'Кількість',
      price: 'Ціна',
      status: 'Статус',
    };

    selectedColumns.forEach((col) => {
      if (headerMap[col]) {
        headers.push(headerMap[col]);
      }
    });

    const rows = products.map((product) => {
      const row: string[] = [];
      selectedColumns.forEach((col) => {
        let value = '';
        switch (col) {
          case 'id':
            value = String(product.id);
            break;
          case 'name':
            value = product.name || '-';
            break;
          case 'brand':
            value = product.brand || '-';
            break;
          case 'type':
            value = product.type || '-';
            break;
          case 'kiosk_name':
            value = product.kiosk_name || '-';
            break;
          case 'quantity':
            value = String(product.quantity);
            break;
          case 'price':
            value = parseFloat(String(product.price || 0)).toFixed(2);
            break;
          case 'status':
            value = product.status === 'available' ? 'В наявності' : 'Немає';
            break;
        }
        // Екранування ком та лапок для CSV
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
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
    link.download = `products_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Товари успішно експортовано');
    setShowExportModal(false);
  };

  const downloadTemplate = () => {
    const headers = ['Назва', 'Бренд', 'Тип', 'Ціна', 'Кількість', 'Ларьок', 'Статус'];
    const example = ['Pod-система X', 'Brand', 'Pod-системи', '500.00', '10', 'Ларьок 1', 'available'];
    const csv = [headers, example].map((row) => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'products_template.csv';
    link.click();
    toast.success('Шаблон завантажено');
  };

  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))];
  const types = [...new Set(products.map((p) => p.type).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Товари</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="btn bg-green-500 hover:bg-green-600 text-white"
          >
            📥 Експорт
          </button>
          <button
            onClick={() => {
              setShowImportModal(true);
              setImportPreview([]);
            }}
            className="btn bg-blue-500 hover:bg-blue-600 text-white"
          >
            📤 Імпорт CSV
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            + Додати товар
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Пошук..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input"
          />
          <select
            value={filters.brand}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
            className="input"
          >
            <option value="">Всі бренди</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input"
          >
            <option value="">Всі типи</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
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
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="">Всі статуси</option>
            <option value="available">В наявності</option>
            <option value="out_of_stock">Немає в наявності</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">Завантаження...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Бренд</th>
                  <th>Тип</th>
                  <th>Ларьок</th>
                  <th>Кількість</th>
                  <th>Ціна</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      Немає товарів
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td className="font-medium">{product.name}</td>
                      <td>{product.brand || '-'}</td>
                      <td>{product.type || '-'}</td>
                      <td>{product.kiosk_name || '-'}</td>
                      <td>{product.quantity}</td>
                      <td className="font-semibold">{parseFloat(String(product.price || 0)).toFixed(2)} ₴</td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            product.status === 'available'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {product.status === 'available' ? 'В наявності' : 'Немає'}
                        </span>
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setShowModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-700 text-sm"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Видалити
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingProduct ? 'Редагувати товар' : 'Додати товар'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Назва *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingProduct?.name}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Бренд</label>
                <input
                  type="text"
                  name="brand"
                  defaultValue={editingProduct?.brand}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Тип</label>
                <input
                  type="text"
                  name="type"
                  defaultValue={editingProduct?.type}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ціна *</label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  defaultValue={editingProduct?.price ? parseFloat(String(editingProduct.price)) : ''}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Кількість *</label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={editingProduct?.quantity || 0}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ларьок *</label>
                <select name="kiosk_id" defaultValue={editingProduct?.kiosk_id ? String(editingProduct.kiosk_id) : ''} className="input" required>
                  <option value="">Виберіть ларьок</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={kiosk.id}>
                      {kiosk.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Статус</label>
                <select name="status" defaultValue={editingProduct?.status || 'available'} className="input">
                  <option value="available">В наявності</option>
                  <option value="out_of_stock">Немає в наявності</option>
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
                    setEditingProduct(null);
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Імпорт товарів з CSV</h2>
            
            {importPreview.length === 0 ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer block"
                  >
                    <div className="text-4xl mb-4">📁</div>
                    <div className="text-lg font-medium mb-2">Натисніть для завантаження CSV файлу</div>
                    <div className="text-sm text-gray-500">Або перетягніть файл сюди</div>
                  </label>
                </div>
                <div className="flex justify-between items-center">
                  <button
                    onClick={downloadTemplate}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    📥 Завантажити шаблон CSV
                  </button>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="btn btn-secondary"
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="font-medium mb-2">Прев'ю імпорту:</div>
                  <div className="text-sm text-gray-600">
                    Знайдено товарів: {importPreview.length}
                    <br />
                    Валідних: {importPreview.filter((p) => !p.errors || p.errors.length === 0).length}
                    <br />
                    З помилками: {importPreview.filter((p) => p.errors && p.errors.length > 0).length}
                  </div>
                </div>
                
                <div className="overflow-x-auto max-h-96">
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>Назва</th>
                        <th>Бренд</th>
                        <th>Тип</th>
                        <th>Ціна</th>
                        <th>Кількість</th>
                        <th>Ларьок</th>
                        <th>Статус</th>
                        <th>Помилки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((product, index) => {
                        const hasErrors = product.errors && product.errors.length > 0;
                        const kioskName = kiosks.find((k) => k.id === product.kiosk_id)?.name || 'Не знайдено';
                        return (
                          <tr key={index} className={hasErrors ? 'bg-red-50' : ''}>
                            <td>{product.name}</td>
                            <td>{product.brand || '-'}</td>
                            <td>{product.type || '-'}</td>
                            <td>{product.price.toFixed(2)} ₴</td>
                            <td>{product.quantity}</td>
                            <td>{kioskName}</td>
                            <td>{product.status === 'out_of_stock' ? 'Немає' : 'В наявності'}</td>
                            <td className={hasErrors ? 'text-red-600 text-xs' : 'text-green-600 text-xs'}>
                              {hasErrors ? product.errors?.join(', ') : '✓ OK'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      setImportPreview([]);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    Завантажити інший файл
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setImportPreview([]);
                      }}
                      className="btn btn-secondary"
                    >
                      Скасувати
                    </button>
                    <button
                      onClick={handleImportConfirm}
                      disabled={importing || importPreview.filter((p) => !p.errors || p.errors.length === 0).length === 0}
                      className="btn btn-primary disabled:opacity-50"
                    >
                      {importing ? 'Імпортую...' : 'Підтвердити імпорт'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Експорт товарів</h2>
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
                        {key === 'name' && 'Назва'}
                        {key === 'brand' && 'Бренд'}
                        {key === 'type' && 'Тип'}
                        {key === 'kiosk_name' && 'Ларьок'}
                        {key === 'quantity' && 'Кількість'}
                        {key === 'price' && 'Ціна'}
                        {key === 'status' && 'Статус'}
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
                      name: true,
                      brand: true,
                      type: true,
                      kiosk_name: true,
                      quantity: true,
                      price: true,
                      status: true,
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
                      name: true,
                      brand: false,
                      type: false,
                      kiosk_name: true,
                      quantity: true,
                      price: true,
                      status: false,
                    });
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Мінімальний
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
                  onClick={handleExportProducts}
                  className="btn btn-primary flex-1"
                >
                  Експортувати
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
