import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      // Закриваємо камеру при закритті модального вікна
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    let mounted = true;

    const startCamera = async () => {
      try {
        setError(null);
        setScanning(true);

        // Спробуємо використати BarcodeDetector API (Chrome, Edge)
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore - BarcodeDetector може бути не в типах
            barcodeDetectorRef.current = new BarcodeDetector({
              formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'codabar']
            });
          } catch (e) {
            console.warn('BarcodeDetector не підтримується:', e);
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Задня камера на мобільних
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          // Починаємо сканування QR-кодів та штрих-кодів
          startScanning();
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Не вдалося отримати доступ до камери');
          setScanning(false);
        }
      }
    };

    const startScanning = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) return;

      const scan = async () => {
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || !mounted) return;

        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Використовуємо BarcodeDetector API якщо доступний
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(canvas);
              if (barcodes && barcodes.length > 0) {
                const detectedCode = barcodes[0].rawValue;
                if (detectedCode) {
                  onScan(detectedCode);
                  return;
                }
              }
            } catch (e) {
              // Ігноруємо помилки детекції
            }
          }

        } catch (e) {
          // Ігноруємо помилки сканування
        }
      };

      // Скануємо кожні 300мс
      scanIntervalRef.current = window.setInterval(scan, 300);
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  // Обробка введення з клавіатури (для USB сканерів)
  useEffect(() => {
    if (!isOpen) return;

    let barcodeBuffer = '';
    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyPress = (e: KeyboardEvent) => {
      // USB сканери зазвичай надсилають Enter після штрих-коду
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault();
        onScan(barcodeBuffer.trim());
        barcodeBuffer = '';
        clearTimeout(barcodeTimeout);
      } else if (e.key.length === 1) {
        // Збираємо символи
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
          barcodeBuffer = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearTimeout(barcodeTimeout);
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-opacity-85 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-gray-100">Сканування штрих-коду / QR-коду</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <div className="text-red-600 dark:text-red-400 mb-4">⚠️ {error}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Переконайтеся, що ви надали доступ до камери або використовуйте USB сканер
            </p>
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                Альтернатива: введіть штрих-код вручну в поле пошуку
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-blue-500 rounded-lg w-3/4 h-1/2" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Наведіть камеру на штрих-код або QR-код товару
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Підтримуються: QR-коди товарів, штрих-коди, USB сканери
              </p>
            </div>
          </div>
        )}

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

