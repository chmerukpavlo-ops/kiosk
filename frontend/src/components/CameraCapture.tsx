import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from './Toast';

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
  aspectRatio?: number; // width/height
}

export function CameraCapture({ onCapture, onClose, aspectRatio = 1 }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Дозвіл на доступ до камери не надано'
          : err.name === 'NotFoundError'
          ? 'Камера не знайдена'
          : 'Помилка доступу до камери'
      );
      toast.error('Не вдалося відкрити камеру');
    }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size based on aspect ratio
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    let width = videoWidth;
    let height = videoHeight;
    
    if (aspectRatio) {
      const videoAspect = videoWidth / videoHeight;
      if (videoAspect > aspectRatio) {
        // Video is wider, crop width
        width = videoHeight * aspectRatio;
      } else {
        // Video is taller, crop height
        height = videoWidth / aspectRatio;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // Draw video frame to canvas
    const x = (videoWidth - width) / 2;
    const y = (videoHeight - height) / 2;
    context.drawImage(video, x, y, width, height, 0, 0, width, height);

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    stopCamera();
    onCapture(imageDataUrl);
  }, [aspectRatio, onCapture, stopCamera]);

  const switchCamera = useCallback(async () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    await startCamera();
  }, [startCamera]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50 text-white z-10">
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          Скасувати
        </button>
        <h2 className="text-lg font-semibold">Камера</h2>
        <button
          onClick={switchCamera}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          title="Перемкнути камеру"
        >
          🔄
        </button>
      </div>

      {/* Video preview */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {error ? (
          <div className="text-white text-center p-8">
            <div className="text-4xl mb-4">📷</div>
            <p className="text-lg mb-2">{error}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg mt-4"
            >
              Спробувати ще раз
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            {/* Capture overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border-4 border-white/50" />
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/50 flex justify-center">
        <button
          onClick={capturePhoto}
          disabled={!stream || !!error}
          className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="w-full h-full rounded-full bg-white" />
        </button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

