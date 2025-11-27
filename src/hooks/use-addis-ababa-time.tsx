import React, { useState, useEffect } from 'react';

const ADDIS_ABABA_TIMEZONE = 'Africa/Addis_Ababa';

export function useAddisAbabaTime() {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Format the date and time for Addis Ababa (EAT, UTC+3)
      const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: ADDIS_ABABA_TIMEZONE,
      });
      
      setTimeString(formatter.format(now));
    };

    updateTime(); // Initial call
    const intervalId = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, []);

  return timeString;
}