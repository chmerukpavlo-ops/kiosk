import { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from './Toast';

interface Product {
  id: number;
  name: string;
  brand?: string;
  type?: string;
  price: number | string;
  quantity: number;
  final_price?: number;
  active_discount_percent?: number;
  reason?: string;
}

interface ProductRecommendationsProps {
  productId?: number;
  onProductSelect: (product: Product) => void;
  limit?: number;
}

export function ProductRecommendations({ 
  productId, 
  onProductSelect,
  limit = 5 
}: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [productId, limit]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (productId) {
        params.append('product_id', String(productId));
      }
      params.append('limit', String(limit));

      const response = await api.get(`/recommendations/products?${params.toString()}`);
      setRecommendations(response.data || []);
    } catch (error: any) {
      console.error('Failed to load recommendations:', error);
      // Don't show error toast - recommendations are optional
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error('Товар закінчився');
      return;
    }
    onProductSelect(product);
  };

  if (loading || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <span>💡</span>
        <span>Рекомендації</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {recommendations.map((product) => {
          const price = product.final_price || parseFloat(String(product.price || 0));
          const hasDiscount = product.active_discount_percent && product.active_discount_percent > 0;

          return (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              disabled={product.quantity <= 0}
              className="text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {product.name}
                  </p>
                  {product.brand && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {product.brand}
                    </p>
                  )}
                </div>
                <div className="ml-2 text-right">
                  <p className={`text-sm font-semibold ${hasDiscount ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {price.toFixed(2)} ₴
                  </p>
                  {hasDiscount && (
                    <p className="text-xs text-gray-400 line-through">
                      {parseFloat(String(product.price || 0)).toFixed(2)} ₴
                    </p>
                  )}
                </div>
              </div>
              
              {product.reason && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {product.reason}
                </p>
              )}
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Залишок: {product.quantity} шт.
                </span>
                {product.quantity > 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Додати →
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

