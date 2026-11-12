import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  initialSeconds: number;
  onExpire?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ initialSeconds, onExpire }) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    hasExpiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpire?.();
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft < 60;

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-md text-sm font-mono font-medium border ${
        isUrgent
          ? 'bg-rose-950/40 text-rose-400 border-rose-800 animate-pulse'
          : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span>
        Hold expires in: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
};
