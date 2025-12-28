import { ReactNode, useState, useRef, useEffect } from 'react';

interface SwipeableItemProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  threshold?: number;
  disabled?: boolean;
}

export function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = 100,
  disabled = false,
}: SwipeableItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;

    const element = itemRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      setIsSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping) return;
      
      currentX.current = e.touches[0].clientX;
      const deltaX = currentX.current - startX.current;
      
      // Limit swipe distance
      const maxSwipe = 120;
      const newTranslateX = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
      setTranslateX(newTranslateX);
    };

    const handleTouchEnd = () => {
      if (!isSwiping) return;

      const deltaX = currentX.current - startX.current;
      const absDeltaX = Math.abs(deltaX);

      if (absDeltaX >= threshold) {
        if (deltaX < 0 && onSwipeLeft) {
          // Swipe left
          onSwipeLeft();
        } else if (deltaX > 0 && onSwipeRight) {
          // Swipe right
          onSwipeRight();
        }
      }

      // Reset position
      setTranslateX(0);
      setIsSwiping(false);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSwiping, onSwipeLeft, onSwipeRight, threshold, disabled]);

  const showLeftAction = translateX < -threshold / 2;
  const showRightAction = translateX > threshold / 2;

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {leftAction && (
          <div
            className={`flex items-center justify-start px-4 bg-red-500 text-white transition-opacity ${
              showLeftAction ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ width: '120px' }}
          >
            {leftAction}
          </div>
        )}
        <div className="flex-1" />
        {rightAction && (
          <div
            className={`flex items-center justify-end px-4 bg-green-500 text-white transition-opacity ${
              showRightAction ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ width: '120px' }}
          >
            {rightAction}
          </div>
        )}
      </div>

      {/* Main content */}
      <div
        ref={itemRef}
        className="relative bg-white dark:bg-gray-800 transition-transform"
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}

