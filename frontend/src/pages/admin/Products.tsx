import { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { format } from 'date-fns';
import { toast } from '../../components/Toast';
import { formatErrorMessage } from '../../lib/errorHandler';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { SkeletonTable } from '../../components/Skeleton';
import { Tooltip } from '../../components/Tooltip';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { QRCodeModal } from '../../components/QRCodeModal';
import { ImageUpload } from '../../components/ImageUpload';
import { copyToClipboard, copyTableToClipboard, formatValueForCopy } from '../../lib/copyToClipboard';
import { useAutoSave } from '../../lib/useAutoSave';

interface Product {
  id: number;
  name: string;
  brand?: string;
  type?: string;
  price: number | string;
  purchase_price?: number | string;
  quantity: number;
  kiosk_id: number;
  kiosk_name?: string;
  status: string;
  discount_percent?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  active_discount_percent?: number;
  final_price?: number;
  low_stock_threshold?: number;
  target_stock_level?: number;
  auto_reorder?: boolean;
  image_url?: string | null;
}

interface ImportProduct {
  name: string;
  brand?: string;
  type?: string;
  price: number;
  purchase_price?: number;
  quantity: number;
  kiosk_id: number;
  status: string;
  errors?: string[];
}

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showBulkDiscountModal, setShowBulkDiscountModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrProduct, setQrProduct] = useState<{ id: number; name: string } | null>(null);
  
  // Завантажуємо фільтри з localStorage
  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem('products_filters');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load filters from storage:', e);
    }
    return {
      search: '',
      brand: '',
      type: '',
      kiosk_id: '',
      status: '',
    };
  };

  const [filters, setFilters] = useState(loadFiltersFromStorage);

  // Зберігаємо фільтри в localStorage при зміні
  useEffect(() => {
    try {
      localStorage.setItem('products_filters', JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to storage:', e);
    }
  }, [filters]);

  useEffect(() => {
    loadKiosks();
    loadProducts();
  }, [filters]);

  const openDetails = (product: Product) => {
    // Mobile-only behavior: tap a row to view full details
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setDetailsProduct(product);
      setShowDetailsModal(true);
    }
  };

  const highlightSearch = (text: string, search: string) => {
    if (!search || !text) return text;
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  const loadKiosks = async () => {
    try {
      const response = await api.get('/kiosks');
      setKiosks(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Failed to load kiosks:', error);
      setKiosks([]);
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast.error(formatErrorMessage(error));
      }
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
    const product = products.find(p => p.id === id);
    if (product) {
      setDeleteConfirm({ id, name: product.name });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.delete(`/products/${deleteConfirm.id}`);
      toast.success('Товар успішно видалено');
      setDeleteConfirm(null);
      loadProducts();
    } catch (error: any) {
      toast.error(formatErrorMessage(error));
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataObj = new FormData(e.currentTarget);
    
    const formData = formDataObj;
    const purchasePrice = formData.get('purchase_price');
    const createExpense = formData.get('create_expense') === 'on';
    const discountPercent = formData.get('discount_percent');
    const discountStartDate = formData.get('discount_start_date');
    const discountEndDate = formData.get('discount_end_date');
    const lowStockThresholdRaw = formData.get('low_stock_threshold');
    const targetStockLevelRaw = formData.get('target_stock_level');
    const autoReorder = formData.get('auto_reorder') === 'on';
    const priceValue = parseFloat(formData.get('price') as string);
    const quantityValue = parseInt(formData.get('quantity') as string);
    const kioskIdValue = parseInt(formData.get('kiosk_id') as string);
    const lowStockThresholdValue = lowStockThresholdRaw !== null && String(lowStockThresholdRaw) !== ''
      ? parseInt(String(lowStockThresholdRaw), 10)
      : 5;
    const targetStockLevelValue = targetStockLevelRaw !== null && String(targetStockLevelRaw) !== ''
      ? parseInt(String(targetStockLevelRaw), 10)
      : 10;
    
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error('Невірна ціна товару');
      return;
    }
    
    if (isNaN(quantityValue) || quantityValue < 0) {
      toast.error('Невірна кількість товару');
      return;
    }
    
    if (isNaN(kioskIdValue) || kioskIdValue <= 0) {
      toast.error('Оберіть ларьок');
      return;
    }

    if (isNaN(lowStockThresholdValue) || lowStockThresholdValue < 0) {
      toast.error('Невірний поріг низького залишку');
      return;
    }

    if (isNaN(targetStockLevelValue) || targetStockLevelValue < 0) {
      toast.error('Невірний цільовий рівень залишку');
      return;
    }
    
    const data = {
      name: formData.get('name'),
      brand: formData.get('brand'),
      type: formData.get('type'),
      price: priceValue,
      purchase_price: purchasePrice && purchasePrice !== '' ? parseFloat(purchasePrice as string) : null,
      quantity: quantityValue,
      kiosk_id: kioskIdValue,
      status: formData.get('status') || 'available',
      create_expense: createExpense && !editingProduct, // Тільки при створенні нового товару
      discount_percent: discountPercent && discountPercent !== '' ? parseFloat(discountPercent as string) : null,
      discount_start_date: discountStartDate && discountStartDate !== '' ? discountStartDate : null,
      discount_end_date: discountEndDate && discountEndDate !== '' ? discountEndDate : null,
      low_stock_threshold: lowStockThresholdValue,
      target_stock_level: targetStockLevelValue,
      auto_reorder: autoReorder,
    };

    setSaving(true);
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, data);
        toast.success('Товар успішно оновлено');
      } else {
        await api.post('/products', data);
        toast.success(createExpense && purchasePrice ? 'Товар додано та витрата створена!' : 'Товар успішно додано');
      }
      setShowModal(false);
      setEditingProduct(null);
      setProductImage(null);
      await loadProducts();
    } catch (error: any) {
      toast.error(formatErrorMessage(error));
    } finally {
      setSaving(false);
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
            } else if (header.includes('собівартість') || header.includes('purchase_price') || header.includes('закупівля')) {
              row.purchase_price = parseFloat(value) || null;
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

      // Масове додавання товарів через bulk-import endpoint
      const productsToImport = validProducts.map((product) => ({
        name: product.name,
        brand: product.brand,
        type: product.type,
        price: product.price,
        purchase_price: product.purchase_price || null,
        quantity: product.quantity,
        kiosk_id: product.kiosk_id,
        status: product.status || 'available',
      }));

      const response = await api.post('/products/bulk-import', {
        products: productsToImport,
        create_expenses: true, // Автоматично створювати витрати при імпорті
      });

      toast.success(
        response.data.expense_created
          ? `Успішно імпортовано ${validProducts.length} товарів. Витрата на закупівлю створена автоматично.`
          : `Успішно імпортовано ${validProducts.length} товарів`
      );
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
            <div className="flex gap-2 flex-wrap">
              {selectedProducts.length > 0 && (
                <>
                  <button
                    onClick={() => setShowBulkUpdateModal(true)}
                    className="btn bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    ✏️ Масове оновлення цін ({selectedProducts.length})
                  </button>
                  <button
                    onClick={() => setShowBulkDiscountModal(true)}
                    className="btn bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    🏷️ Масове додавання знижок ({selectedProducts.length})
                  </button>
                </>
              )}
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

        {/* Quick Filters */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Швидкі фільтри:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setOnlyLowStock(true);
                  setFilters({ ...filters, status: '' });
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  onlyLowStock
                    ? 'bg-red-100 border-red-300 text-red-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                ⚠️ Низькі залишки
              </button>
              <button
                onClick={() => {
                  setOnlyLowStock(false);
                  setFilters({ ...filters, status: 'available' });
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  filters.status === 'available' && !onlyLowStock
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                ✅ В наявності
              </button>
              <button
                onClick={() => {
                  setOnlyLowStock(false);
                  setFilters({ ...filters, status: 'out_of_stock' });
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  filters.status === 'out_of_stock' && !onlyLowStock
                    ? 'bg-gray-100 border-gray-300 text-gray-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                ❌ Немає в наявності
              </button>
              {(filters.status || onlyLowStock || filters.brand || filters.type || filters.kiosk_id || filters.search) && (
                <button
                  onClick={() => {
                    setOnlyLowStock(false);
                    setFilters({
                      search: '',
                      brand: '',
                      type: '',
                      kiosk_id: '',
                      status: '',
                    });
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 border-2 border-gray-300 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  ✕ Скинути
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        {loading ? (
          <SkeletonTable rows={8} columns={8} />
        ) : (
          <div className="overflow-x-auto md:overflow-x-auto">
            <table className="table md:min-w-[1280px]">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-gray-50 w-12 hidden md:table-cell">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === products.length && products.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts(products.map(p => p.id));
                        } else {
                          setSelectedProducts([]);
                        }
                      }}
                      className="h-4 w-4 text-primary-600"
                    />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50">Назва</th>
                  <th className="sticky top-0 z-10 bg-gray-50 hidden md:table-cell">Бренд</th>
                  <th className="sticky top-0 z-10 bg-gray-50 hidden md:table-cell">Тип</th>
                  <th className="sticky top-0 z-10 bg-gray-50 hidden md:table-cell">Ларьок</th>
                  <th className="sticky top-0 z-10 bg-gray-50 whitespace-nowrap text-right">Кількість</th>
                  <th className="sticky top-0 z-10 bg-gray-50 whitespace-nowrap text-right">Ціна</th>
                  <th className="sticky top-0 z-10 bg-gray-50 whitespace-nowrap text-right hidden lg:table-cell">Собівартість</th>
                  <th className="sticky top-0 z-10 bg-gray-50 whitespace-nowrap text-right hidden lg:table-cell">Маржа</th>
                  <th className="sticky top-0 z-10 bg-gray-50 whitespace-nowrap text-right hidden lg:table-cell">Маржинальність</th>
                  <th className="sticky top-0 z-10 bg-gray-50 whitespace-nowrap hidden md:table-cell">Статус</th>
                  <th className="sticky top-0 z-10 bg-gray-50 w-40 whitespace-nowrap">Дії</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500">
                      Немає товарів
                    </td>
                  </tr>
                ) : (
                  (onlyLowStock
                    ? products.filter((p) => p.quantity <= (p.low_stock_threshold ?? 5))
                    : products
                  ).map((product) => {
                    const price = parseFloat(String(product.price || 0));
                    const purchasePrice = parseFloat(String(product.purchase_price || 0));
                    const margin = purchasePrice > 0 ? price - purchasePrice : 0;
                    const marginPercent = price > 0 && purchasePrice > 0 ? (margin / price) * 100 : 0;
                    const lowThreshold = product.low_stock_threshold ?? 5;
                    const isLowStock = product.quantity <= lowThreshold;
                    
                    return (
                      <tr
                        key={product.id}
                        className={`cursor-pointer md:cursor-default ${isLowStock ? 'bg-red-50/40' : ''}`}
                        onClick={() => openDetails(product)}
                      >
                        <td className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                            className="h-4 w-4 text-primary-600"
                          />
                        </td>
                        <td 
                          className="font-medium"
                          onDoubleClick={async (e) => {
                            const text = product.name || '';
                            if (text && await copyToClipboard(text)) {
                              toast.success('Назву скопійовано');
                            }
                          }}
                          title="Подвійний клік для копіювання"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate" title={product.name}>
                              {filters.search ? highlightSearch(product.name, filters.search) : product.name}
                            </span>
                            {isLowStock && (
                              <span className="shrink-0 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                Мало (≤ {lowThreshold})
                              </span>
                            )}
                            {(product.active_discount_percent || product.discount_percent) && 
                             parseFloat(String(product.active_discount_percent || product.discount_percent || 0)) > 0 &&
                             (!product.discount_start_date || new Date(product.discount_start_date) <= new Date()) &&
                             (!product.discount_end_date || new Date(product.discount_end_date) >= new Date()) && (
                              <span className="shrink-0 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                -{parseFloat(String(product.active_discount_percent || product.discount_percent || 0)).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="max-w-[160px] truncate hidden md:table-cell" title={product.brand || ''}>{product.brand || '-'}</td>
                        <td className="max-w-[160px] truncate hidden md:table-cell" title={product.type || ''}>{product.type || '-'}</td>
                        <td className="max-w-[200px] truncate hidden md:table-cell" title={product.kiosk_name || ''}>{product.kiosk_name || '-'}</td>
                        <td className="whitespace-nowrap text-right">{product.quantity}</td>
                        <td className="font-semibold whitespace-nowrap text-right">
                          {product.final_price && !isNaN(parseFloat(String(product.final_price))) && parseFloat(String(product.final_price)) < price ? (
                            <div>
                              <div className="text-gray-400 line-through text-sm">{price.toFixed(2)} ₴</div>
                              <div className="text-red-600">{parseFloat(String(product.final_price)).toFixed(2)} ₴</div>
                            </div>
                          ) : (
                            <span>{price.toFixed(2)} ₴</span>
                          )}
                        </td>
                        <td className="text-gray-600 whitespace-nowrap text-right hidden lg:table-cell">
                          {purchasePrice > 0 ? `${purchasePrice.toFixed(2)} ₴` : '-'}
                        </td>
                        <td className={`whitespace-nowrap text-right hidden lg:table-cell ${margin > 0 ? 'font-semibold text-green-600' : margin < 0 ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                          {purchasePrice > 0 ? `${margin.toFixed(2)} ₴` : '-'}
                        </td>
                        <td className="whitespace-nowrap text-right hidden lg:table-cell">
                          {purchasePrice > 0 ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              marginPercent >= 30 ? 'bg-green-100 text-green-700' :
                              marginPercent >= 15 ? 'bg-yellow-100 text-yellow-700' :
                              marginPercent > 0 ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {marginPercent.toFixed(1)}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="whitespace-nowrap hidden md:table-cell">
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
                      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => {
                              setQrProduct({ id: product.id, name: product.name });
                              setShowQRModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            title="Показати QR-код"
                          >
                            📱 QR
                          </button>
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
                    );
                  })
                )}
              </tbody>
            </table>
            <div className="md:hidden text-xs text-gray-500 mt-3">
              Порада: натисніть на товар, щоб побачити всі деталі.
            </div>
          </div>
        )}
      </div>

      {/* Mobile Details Modal */}
      {showDetailsModal && detailsProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white w-full md:max-w-lg md:rounded-xl rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold truncate" title={detailsProduct.name}>
                  {detailsProduct.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {detailsProduct.brand || '—'} • {detailsProduct.type || '—'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setDetailsProduct(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Ларьок</span>
                <span className="font-medium text-right">{detailsProduct.kiosk_name || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Кількість</span>
                <span className="font-semibold">{detailsProduct.quantity}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Ціна</span>
                <span className="font-semibold">
                  {parseFloat(String(detailsProduct.price || 0)).toFixed(2)} ₴
                </span>
              </div>

              {detailsProduct.final_price && parseFloat(String(detailsProduct.final_price)) > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Ціна зі знижкою</span>
                  <span className="font-semibold text-red-600">
                    {parseFloat(String(detailsProduct.final_price)).toFixed(2)} ₴
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Статус</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  detailsProduct.status === 'available'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {detailsProduct.status === 'available' ? 'В наявності' : 'Немає'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setQrProduct({ id: detailsProduct.id, name: detailsProduct.name });
                  setShowQRModal(true);
                }}
                className="btn bg-blue-600 hover:bg-blue-700 text-white flex-1"
              >
                📱 QR-код
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setEditingProduct(detailsProduct);
                  setShowModal(true);
                }}
                className="btn btn-primary flex-1"
              >
                Редагувати
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleDelete(detailsProduct.id);
                }}
                className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm font-medium mb-1">Ціна продажу *</label>
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
                <label className="block text-sm font-medium mb-1">Собівартість (закупівля)</label>
                <input
                  type="number"
                  step="0.01"
                  name="purchase_price"
                  defaultValue={editingProduct?.purchase_price ? parseFloat(String(editingProduct.purchase_price)) : ''}
                  className="input"
                  placeholder="Необов'язково"
                />
              </div>
              {!editingProduct && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="create_expense"
                    name="create_expense"
                    className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="create_expense" className="text-sm text-gray-700">
                    Створити витрату "Закупівля" автоматично (якщо вказано собівартість)
                  </label>
                </div>
              )}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Поріг низького залишку</label>
                  <input
                    type="number"
                    name="low_stock_threshold"
                    min={0}
                    defaultValue={editingProduct?.low_stock_threshold ?? 5}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Цільовий рівень</label>
                  <input
                    type="number"
                    name="target_stock_level"
                    min={0}
                    defaultValue={editingProduct?.target_stock_level ?? 10}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_reorder"
                  name="auto_reorder"
                  defaultChecked={!!editingProduct?.auto_reorder}
                  className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="auto_reorder" className="text-sm text-gray-700">
                  Авто-замовлення (створювати чернетку замовлення при низькому залишку)
                </label>
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
              
              {/* Discount Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-3">Знижка / Акція</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Відсоток знижки (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      name="discount_percent"
                      defaultValue={editingProduct?.discount_percent || ''}
                      className="input"
                      placeholder="0-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Дата початку</label>
                      <input
                        type="date"
                        name="discount_start_date"
                        defaultValue={editingProduct?.discount_start_date || ''}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Дата закінчення</label>
                      <input
                        type="date"
                        name="discount_end_date"
                        defaultValue={editingProduct?.discount_end_date || ''}
                        className="input"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Залиште дати порожніми для постійної знижки. Знижка буде активна між вказаними датами.
                  </p>
                </div>
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
                            <td>{parseFloat(String(product.price || 0)).toFixed(2)} ₴</td>
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

      {/* Bulk Update Prices Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              Масове оновлення цін ({selectedProducts.length} товарів)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updateType = formData.get('updateType');
                const value = formData.get('value');

                try {
                  const updates = selectedProducts.map((id) => {
                    const product = products.find((p) => p.id === id);
                    if (!product) return null;

                    let newPrice = parseFloat(String(product.price || 0));
                    if (updateType === 'percent') {
                      newPrice = newPrice * (1 + parseFloat(String(value || 0)) / 100);
                    } else if (updateType === 'fixed') {
                      newPrice = newPrice + parseFloat(String(value || 0));
                    } else if (updateType === 'set') {
                      newPrice = parseFloat(String(value || 0));
                    }

                    return { id, price: Math.max(0, newPrice) };
                  }).filter(Boolean) as Array<{ id: number; price: number }>;

                  // Підтвердження перед bulk update
                  const confirmed = window.confirm(
                    `Ви впевнені, що хочете оновити ціни для ${updates.length} товарів? Цю дію неможливо скасувати.`
                  );
                  if (!confirmed) return;

                  await api.put('/products/bulk-update-prices', { updates });
                  toast.success(`Ціни оновлено для ${updates.length} товарів!`);
                  setShowBulkUpdateModal(false);
                  setSelectedProducts([]);
                  loadProducts();
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Помилка оновлення цін');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Тип оновлення</label>
                <select name="updateType" className="input" required>
                  <option value="percent">Відсоток (+/- %)</option>
                  <option value="fixed">Фіксована сума (+/- ₴)</option>
                  <option value="set">Встановити ціну (₴)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Значення</label>
                <input
                  type="number"
                  step="0.01"
                  name="value"
                  className="input"
                  placeholder="Наприклад: 10 (для +10% або +10₴)"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Для відсотка: 10 = +10%, -5 = -5%<br />
                  Для фіксованої суми: 10 = +10₴, -5 = -5₴<br />
                  Для встановлення: вкажіть нову ціну
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Буде оновлено {selectedProducts.length} товарів. Цю дію неможливо скасувати.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkUpdateModal(false);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Оновити ціни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Update Discounts Modal */}
      {showBulkDiscountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              Масове додавання знижок ({selectedProducts.length} товарів)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const discountPercent = formData.get('discount_percent');
                const discountStartDate = formData.get('discount_start_date');
                const discountEndDate = formData.get('discount_end_date');

                try {
                  const updates = selectedProducts.map((id) => ({
                    id,
                    discount_percent: discountPercent ? parseFloat(String(discountPercent)) : null,
                    discount_start_date: discountStartDate && discountStartDate !== '' ? String(discountStartDate) : null,
                    discount_end_date: discountEndDate && discountEndDate !== '' ? String(discountEndDate) : null,
                  }));

                  // Оновлюємо кожен товар
                  await Promise.all(
                    updates.map(update => 
                      api.put(`/products/${update.id}`, {
                        discount_percent: update.discount_percent,
                        discount_start_date: update.discount_start_date,
                        discount_end_date: update.discount_end_date,
                      })
                    )
                  );

                  toast.success(`Знижки додано для ${updates.length} товарів!`);
                  setShowBulkDiscountModal(false);
                  setSelectedProducts([]);
                  loadProducts();
                } catch (error: any) {
                  toast.error(formatErrorMessage(error));
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Відсоток знижки *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="discount_percent"
                  className="input"
                  placeholder="Наприклад: 10 (для 10%)"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Дата початку</label>
                <input
                  type="date"
                  name="discount_start_date"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Дата закінчення</label>
                <input
                  type="date"
                  name="discount_end_date"
                  className="input"
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Буде додано знижку для {selectedProducts.length} товарів.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDiscountModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Додати знижки
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Видалити товар?"
        message={
          deleteConfirm ? (
            <>
              <p className="mb-2">Ви впевнені, що хочете видалити товар:</p>
              <p className="font-semibold text-gray-900">{deleteConfirm.name}</p>
              <p className="mt-2 text-sm text-gray-600">Цю дію неможливо скасувати.</p>
            </>
          ) : ''
        }
        confirmText="Видалити"
        cancelText="Скасувати"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* QR Code Modal */}
      {qrProduct && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => {
            setShowQRModal(false);
            setQrProduct(null);
          }}
          productId={qrProduct.id}
          productName={qrProduct.name}
        />
      )}
    </div>
  );
}
