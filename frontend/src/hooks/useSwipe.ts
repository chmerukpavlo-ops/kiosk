import { useRef, useState, useEffect } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for swipe (default: 50px)
  velocity?: number; // Minimum velocity for swipe (default: 0.3)
}

export function useSwipe(handlers: SwipeHandlers) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const startPos = useRef({ x: 0, y: 0, time: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const threshold = handlers.threshold || 50;
  const velocity = handlers.velocity || 0.3;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startPos.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      setIsSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping) return;
      const touch = e.touches[0];
      currentPos.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    };

    const handleTouchEnd = () => {
      if (!isSwiping) return;

      const deltaX = currentPos.current.x - startPos.current.x;
      const deltaY = currentPos.current.y - startPos.current.y;
      const deltaTime = Date.now() - startPos.current.time;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const speed = distance / deltaTime;

      // Check if swipe meets threshold and velocity
      if (distance >= threshold && speed >= velocity) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX > absY) {
          // Horizontal swipe
          if (deltaX > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
          } else if (deltaX < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
          }
        } else {
          // Vertical swipe
          if (deltaY > 0 && handlers.onSwipeDown) {
            handlers.onSwipeDown();
          } else if (deltaY < 0 && handlers.onSwipeUp) {
            handlers.onSwipeUp();
          }
        }
      }

      setIsSwiping(false);
      startPos.current = { x: 0, y: 0, time: 0 };
      currentPos.current = { x: 0, y: 0 };
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handlers, isSwiping, threshold, velocity]);

  return { ref: elementRef, isSwiping };
}

