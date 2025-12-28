import { useState, useRef, ChangeEvent } from 'react';
import { CameraCapture } from './CameraCapture';
import { toast } from './Toast';

interface ImageUploadProps {
  currentImage?: string | null;
  onImageChange: (imageDataUrl: string | null) => void;
  aspectRatio?: number;
  maxSizeMB?: number;
}

export function ImageUpload({
  currentImage,
  onImageChange,
  aspectRatio = 1,
  maxSizeMB = 5,
}: ImageUploadProps) {
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Файл занадто великий. Максимальний розмір: ${maxSizeMB}MB`);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Оберіть файл зображення');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageDataUrl = event.target?.result as string;
      onImageChange(imageDataUrl);
      toast.success('Зображення завантажено');
    };
    reader.onerror = () => {
      toast.error('Помилка читання файлу');
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    onImageChange(imageDataUrl);
    setShowCamera(false);
    toast.success('Фото зроблено');
  };

  const handleRemoveImage = () => {
    onImageChange(null);
    toast.success('Зображення видалено');
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Зображення товару
      </label>
      
      {currentImage ? (
        <div className="relative">
          <img
            src={currentImage}
            alt="Product"
            className="w-full h-48 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
            >
              📷 Перефотографувати
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
            >
              🗑️ Видалити
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
          <div className="space-y-3">
            <div className="text-4xl">📷</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Додайте зображення товару
            </div>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
              >
                📁 З файлу
              </button>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                📷 З камери
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          aspectRatio={aspectRatio}
        />
      )}
    </div>
  );
}

