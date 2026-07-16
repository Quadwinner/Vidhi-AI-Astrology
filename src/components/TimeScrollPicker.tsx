// src/components/TimeScrollPicker.tsx
import React, { useState, useEffect, useMemo } from 'react';
import ScrollPicker, { PickerColumn } from './ScrollPicker';

interface TimeScrollPickerProps {
  value: string; // HH:mm format (24-hour)
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TimeScrollPicker({
  value,
  onChange,
  disabled = false,
}: TimeScrollPickerProps) {
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  // Parse initial value or set default (24-hour format)
  useEffect(() => {
    if (value) {
      const [hour24Str, minuteStr] = value.split(':');
      const hour24 = parseInt(hour24Str, 10);
      const minute = parseInt(minuteStr, 10);

      if (!isNaN(hour24) && !isNaN(minute)) {
        const { hour, period } = to12Hour(hour24);
        setSelectedHour(hour.toString().padStart(2, '0'));
        setSelectedMinute(minute.toString().padStart(2, '0'));
        setSelectedPeriod(period);
      }
    } else {
      // Set default to 12:00 AM if no value
      setSelectedHour('12');
      setSelectedMinute('00');
      setSelectedPeriod('AM');
      
      // Notify parent of default value
      onChange('00:00');
    }
  }, []);

  // Generate hour options (01-12)
  const hourOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  }, []);

  // Generate minute options (00-59)
  const minuteOptions = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  }, []);

  const periodOptions = ['AM', 'PM'];

  const columns: PickerColumn[] = [
    {
      id: 'hour',
      values: hourOptions,
      selectedValue: selectedHour,
    },
    {
      id: 'minute',
      values: minuteOptions,
      selectedValue: selectedMinute,
    },
    {
      id: 'period',
      values: periodOptions,
      selectedValue: selectedPeriod,
    },
  ];

  const handleValueChange = (columnIndex: number, value: string) => {
    if (columnIndex === 0) {
      // Hour changed
      setSelectedHour(value);
      notifyChange(value, selectedMinute, selectedPeriod);
    } else if (columnIndex === 1) {
      // Minute changed
      setSelectedMinute(value);
      notifyChange(selectedHour, value, selectedPeriod);
    } else if (columnIndex === 2) {
      // Period changed
      const period = value as 'AM' | 'PM';
      setSelectedPeriod(period);
      notifyChange(selectedHour, selectedMinute, period);
    }
  };

  const notifyChange = (hour: string, minute: string, period: 'AM' | 'PM') => {
    const hour12 = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);

    if (isNaN(hour12) || isNaN(minuteNum)) return;

    const hour24 = to24Hour(hour12, period);
    const formattedTime = `${hour24.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`;
    onChange(formattedTime);
  };

  return (
    <ScrollPicker
      columns={columns}
      onValueChange={handleValueChange}
      initialValues={[selectedHour, selectedMinute, selectedPeriod]}
      disabled={disabled}
    />
  );
}

// Convert 12-hour format to 24-hour format
function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') {
    return hour === 12 ? 0 : hour;
  } else {
    return hour === 12 ? 12 : hour + 12;
  }
}

// Convert 24-hour format to 12-hour format
function to12Hour(hour24: number): { hour: number; period: 'AM' | 'PM' } {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return { hour, period };
}
