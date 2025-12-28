import { useState, useEffect, useRef } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance to trigger refresh (default: 80px)
  disabled?: boolean;
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const { onRefresh, threshold = 80, disabled = false } = options;
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const elementRef = useRef<HTMLElement | null>(null);
  const isRefreshing = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the scrollable area
      if (element.scrollTop > 0) return;
      
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing.current) return;
      
      // Only allow pull if at the top
      if (element.scrollTop > 0) {
        setIsPulling(false);
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        // Prevent default scrolling while pulling
        e.preventDefault();
        setPullDistance(Math.min(distance, threshold * 1.5)); // Allow slight overscroll
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing.current) return;

      if (pullDistance >= threshold) {
        isRefreshing.current = true;
        setPullDistance(threshold);
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Pull to refresh error:', error);
        } finally {
          isRefreshing.current = false;
          setIsPulling(false);
          setPullDistance(0);
        }
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold, disabled, isPulling, pullDistance]);

  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const shouldTrigger = pullDistance >= threshold;

  return {
    ref: elementRef,
    isPulling,
    pullDistance,
    progress,
    shouldTrigger,
    isRefreshing: isRefreshing.current,
  };
}

