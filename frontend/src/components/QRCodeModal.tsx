import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
}

export function QRCodeModal({ isOpen, onClose, productId, productName }: QRCodeModalProps) {
  if (!isOpen) return null;

  const qrValue = `product:${productId}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-gray-100">QR-код товару</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{productName}</p>
            <div className="inline-block p-4 bg-white dark:bg-gray-700 rounded-lg">
              <QRCodeSVG value={qrValue} size={200} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
            Відскануйте QR-код для швидкого пошуку товару
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}

