import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { useRef, useState } from 'react';
import api from '../lib/api';
import { toast } from './Toast';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface ReceiptProps {
  items: ReceiptItem[];
  total: number;
  saleId?: number;
  saleIds?: number[];
  sellerName?: string;
  kioskName?: string;
  paymentMethod?: 'cash' | 'card';
  onClose?: () => void;
}

export function Receipt({ items, total, saleId, saleIds, sellerName, kioskName, paymentMethod = 'cash', onClose }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);

  const printReceipt = () => {
    window.print();
  };

  const downloadPDF = async () => {
    try {
      // Use html2pdf library if available, otherwise fallback to print
      if (typeof window !== 'undefined' && (window as any).html2pdf) {
        const html2pdf = (window as any).html2pdf;
        const element = receiptRef.current;
        if (!element) return;

        const opt = {
          margin: [5, 5, 5, 5],
          filename: `receipt_${saleId || Date.now()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' },
        };

        await html2pdf().set(opt).from(element).save();
      } else {
        // Fallback to print dialog
        printReceipt();
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      printReceipt();
    }
  };

  return (
    <div className="print-container">
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
        @page {
          size: 80mm auto;
          margin: 0;
        }
        .receipt {
          width: 80mm;
          padding: 10mm;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          background: white;
        }
      `}</style>

      <div ref={receiptRef} className="receipt bg-white p-4 max-w-xs mx-auto shadow-lg">
        {/* Header */}
        <div className="text-center mb-4 border-b border-gray-300 pb-3">
          <h1 className="text-xl font-bold mb-1">КІОСК</h1>
          {kioskName && <p className="text-sm text-gray-600">{kioskName}</p>}
          <p className="text-xs text-gray-500 mt-1">
            {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: uk })}
          </p>
          {(saleId || (saleIds && saleIds.length > 0)) && (
            <p className="text-xs text-gray-500 mt-1">
              Чек №{saleId || saleIds?.[0] || 'N/A'}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="mb-4">
          {items.map((item, index) => (
            <div key={index} className="mb-2 pb-2 border-b border-gray-200">
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-gray-600">
                    {item.quantity} шт. × {item.price.toFixed(2)} ₴
                  </p>
                </div>
                <p className="font-semibold text-sm ml-2">
                  {item.total.toFixed(2)} ₴
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t-2 border-gray-400 pt-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">ВСЬОГО:</span>
            <span className="text-lg font-bold">{total.toFixed(2)} ₴</span>
          </div>
          {paymentMethod && (
            <p className="text-xs text-gray-600 mt-1">
              Оплата: {paymentMethod === 'cash' ? 'Готівка' : 'Картка'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 border-t border-gray-300 pt-3">
          {sellerName && <p className="mb-1">Продавець: {sellerName}</p>}
          <p className="mt-2 font-semibold">Дякуємо за покупку!</p>
          <p className="mt-1">Повернення товару протягом 14 днів</p>
          <p className="mt-2 text-xs">Цей чек є підтвердженням покупки</p>
        </div>

        {/* Print buttons (hidden when printing) */}
        <div className="no-print mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={printReceipt}
              className="btn btn-primary flex-1"
            >
              🖨️ Друкувати
            </button>
            <button
              onClick={downloadPDF}
              className="btn bg-green-500 hover:bg-green-600 text-white flex-1"
            >
              📄 PDF
            </button>
            {(saleId || (saleIds && saleIds.length > 0)) && (
              <button
                onClick={() => setShowTelegramModal(true)}
                className="btn bg-blue-500 hover:bg-blue-600 text-white flex-1"
              >
                📱 Telegram
              </button>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary w-full"
            >
              Закрити
            </button>
          )}
        </div>

        {/* Telegram Modal */}
        {showTelegramModal && (
          <div className="no-print fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card max-w-md w-full">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold">Надіслати в Telegram</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Введіть Telegram username або chat_id
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTelegramModal(false);
                    setTelegramInput('');
                  }}
                  className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Telegram username або chat_id *
                  </label>
                  <input
                    type="text"
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    placeholder="@username або 123456789"
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Приклад: @username або 123456789
                    <br />
                    Користувач має спочатку написати боту
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowTelegramModal(false);
                      setTelegramInput('');
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={async () => {
                      if (!telegramInput.trim()) {
                        toast.error('Введіть Telegram username або chat_id');
                        return;
                      }

                      const targetSaleId = saleId || (saleIds && saleIds[0]);
                      if (!targetSaleId) {
                        toast.error('ID продажу не знайдено');
                        return;
                      }

                      setSendingTelegram(true);
                      try {
                        // Determine if it's a chat_id (numeric) or username
                        const isNumeric = /^\d+$/.test(telegramInput.trim());
                        const payload = isNumeric
                          ? { telegram_chat_id: telegramInput.trim() }
                          : { telegram_username: telegramInput.trim().replace('@', '') };

                        await api.post(`/sales/${targetSaleId}/send-telegram`, payload);
                        toast.success('Чек надіслано в Telegram!');
                        setShowTelegramModal(false);
                        setTelegramInput('');
                      } catch (error: any) {
                        console.error('=== Send telegram error ===');
                        console.error('Full error object:', error);
                        console.error('Error response data:', error.response?.data);
                        console.error('Error status:', error.response?.status);
                        console.error('Request payload:', { 
                          saleId: targetSaleId, 
                          telegramInput: telegramInput.trim() 
                        });
                        
                        let errorMessage = 'Помилка надсилання в Telegram';
                        
                        if (error.response?.data) {
                          // Спробуємо отримати детальну інформацію про помилку
                          if (error.response.data.error) {
                            errorMessage = error.response.data.error;
                          } else if (error.response.data.message) {
                            errorMessage = error.response.data.message;
                          } else if (error.response.data.details?.description) {
                            errorMessage = error.response.data.details.description;
                          } else if (error.response.data.description) {
                            errorMessage = error.response.data.description;
                          }
                        } else if (error.message) {
                          errorMessage = error.message;
                        }
                        
                        toast.error(errorMessage);
                      } finally {
                        setSendingTelegram(false);
                      }
                    }}
                    disabled={sendingTelegram || !telegramInput.trim()}
                    className="btn btn-primary flex-1"
                  >
                    {sendingTelegram ? 'Надсилаю...' : 'Надіслати'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

