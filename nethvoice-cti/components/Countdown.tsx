import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  seconds: number;
}

export function CountdownTimer({ seconds }: CountdownTimerProps) {
  const [time, setTime] = useState(seconds);
  const [status, setStatus] = useState('begin');

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime === Math.ceil(seconds / 2)) {
          setStatus('middle');
        }
        if (prevTime === Math.ceil(seconds / 4)) {
          setStatus('end');
        }
        if (prevTime === 0) {
          clearInterval(interval);
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds]);

  const formattedTime = new Date(time * 1000).toISOString().slice(14, 19);

  return (
    <span
      className={`${
        status === 'begin'
          ? 'text-gray-700 dark:text-gray-400'
          : status === 'middle'
          ? 'text-amber-700 dark:text-amber-500'
          : 'text-red-700 dark:text-red-500'
      } w-12 font-mono`}
    >
      {formattedTime}
    </span>
  );
}
