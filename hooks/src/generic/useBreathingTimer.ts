// packages/core/hooks/src/generic/useBreathingTimer.ts

/**
 * @fileoverview useBreathingTimer hook
 * @description Timer hook with wake lock support for breathing exercises
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useState, useEffect, useRef } from 'react';

interface WakeLockSentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

interface UseBreathingTimerProps {
  duration: number;
  onComplete: () => void;
}

/**
 * Hook for managing a breathing timer with wake lock support
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useBreathingTimer({
  duration,
  onComplete,
}: UseBreathingTimerProps) {
  const [status, setStatus] = useState<
    'idle' | 'active' | 'paused' | 'complete'
  >('idle');
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (status === 'active' && navigator.wakeLock) {
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          wakeLockRef.current = sentinel as WakeLockSentinel;
        })
        .catch(() => {});
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setStatus('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Invoke onComplete when status becomes 'complete'
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (status === 'complete') {
      onCompleteRef.current();
    }
  }, [status]);

  // Cleanup effect - runs only on unmount
  // Empty deps intentional: cleanup should only run once when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  const start = () => {
    setStatus('active');
    setTimeRemaining(duration);
  };

  const togglePause = () => {
    setStatus((prev) => (prev === 'active' ? 'paused' : 'active'));
  };

  const restart = () => {
    setStatus('idle');
    setTimeRemaining(duration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    status,
    timeRemaining,
    start,
    togglePause,
    restart,
    formatTime,
  };
}
