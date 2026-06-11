import { useCallback, useEffect, useState } from 'react';

const INITIAL_SECONDS = 30 * 60;

export function useTimer() {
  const [timeLeft, setTimeLeft] = useState(INITIAL_SECONDS);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isPaused]);

  const toggle = useCallback(() => setIsPaused(p => !p), []);
  const reset = useCallback(() => {
    setTimeLeft(INITIAL_SECONDS);
    setIsPaused(false);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progress = (timeLeft / INITIAL_SECONDS) * 100;
  const isExpired = timeLeft === 0;

  return { timeLeft, isPaused, isExpired, displayTime, progress, toggle, reset };
}
