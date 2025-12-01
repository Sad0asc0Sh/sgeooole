import { useState, useEffect } from 'react';

export interface CountdownReturn {
  hours: string;
  minutes: string;
  seconds: string;
  isExpired: boolean;
}

/**
 * Custom hook for countdown timer
 * @param targetDate - The target date/time string (ISO format) or Date object
 * @returns Object with hours, minutes, seconds (padded), and isExpired flag
 */
export const useCountdown = (targetDate: string | Date | undefined): CountdownReturn => {
  const countDownDate = new Date(targetDate || '').getTime();
  const [countDown, setCountDown] = useState<number>(() => {
    if (!targetDate || isNaN(countDownDate)) return -1;
    return countDownDate - new Date().getTime();
  });

  useEffect(() => {
    if (!targetDate || isNaN(countDownDate)) {
      return;
    }

    const interval = setInterval(() => {
      const distance = countDownDate - new Date().getTime();
      setCountDown(distance);

      if (distance < 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [countDownDate, targetDate]);

  return getReturnValues(countDown);
};

/**
 * Helper function to calculate and format time values
 */
const getReturnValues = (countDown: number): CountdownReturn => {
  if (!isFinite(countDown)) {
    return {
      hours: '00',
      minutes: '00',
      seconds: '00',
      isExpired: true,
    };
  }

  // If countdown is negative (expired), return zeros
  if (countDown < 0) {
    return {
      hours: '00',
      minutes: '00',
      seconds: '00',
      isExpired: true,
    };
  }

  // Calculate time parts
  const totalHours = Math.floor(countDown / (1000 * 60 * 60));
  const minutes = Math.floor((countDown % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((countDown % (1000 * 60)) / 1000);

  // Pad with zeros and return
  return {
    hours: String(totalHours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    isExpired: false,
  };
};
