// src/components/DateScrollPicker.tsx
import React, { useState, useEffect, useMemo } from 'react';
import ScrollPicker, { PickerColumn } from './ScrollPicker';

interface DateScrollPickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DateScrollPicker({
  value,
  onChange,
  disabled = false,
  minDate,
  maxDate = new Date(), // Default to today (no future dates)
}: DateScrollPickerProps) {
  const [selectedDay, setSelectedDay] = useState('1');
  const [selectedMonth, setSelectedMonth] = useState('January');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Parse initial value or set default
  useEffect(() => {
    if (value) {
      const [year, month, day] = value.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        setSelectedYear(year.toString());
        setSelectedMonth(MONTHS[month - 1]);
        setSelectedDay(day.toString());
      }
    } else {
      // Set default to today's date if no value
      const today = new Date();
      setSelectedYear(today.getFullYear().toString());
      setSelectedMonth(MONTHS[today.getMonth()]);
      setSelectedDay(today.getDate().toString());
      
      // Notify parent of default value
      const formattedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
      onChange(formattedDate);
    }
  }, []);

  // Generate year options (current year to 100 years ago)
  const yearOptions = useMemo(() => {
    const currentYear = maxDate.getFullYear();
    const startYear = minDate ? minDate.getFullYear() : currentYear - 100;
    const years: string[] = [];
    
    for (let year = currentYear; year >= startYear; year--) {
      years.push(year.toString());
    }
    
    return years;
  }, [minDate, maxDate]);

  // Generate day options based on selected month and year
  const dayOptions = useMemo(() => {
    const monthIndex = MONTHS.indexOf(selectedMonth) + 1;
    const year = parseInt(selectedYear, 10);
    const daysInMonth = getDaysInMonth(monthIndex, year);
    
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  }, [selectedMonth, selectedYear]);

  // Validate and adjust day when month/year changes
  useEffect(() => {
    const currentDay = parseInt(selectedDay, 10);
    const maxDay = dayOptions.length;
    
    if (currentDay > maxDay) {
      setSelectedDay(maxDay.toString());
    }
  }, [dayOptions, selectedDay]);

  const columns: PickerColumn[] = [
    {
      id: 'day',
      values: dayOptions,
      selectedValue: selectedDay,
    },
    {
      id: 'month',
      values: MONTHS,
      selectedValue: selectedMonth,
    },
    {
      id: 'year',
      values: yearOptions,
      selectedValue: selectedYear,
    },
  ];

  const handleValueChange = (columnIndex: number, value: string) => {
    if (columnIndex === 0) {
      // Day changed
      setSelectedDay(value);
      notifyChange(value, selectedMonth, selectedYear);
    } else if (columnIndex === 1) {
      // Month changed
      setSelectedMonth(value);
      notifyChange(selectedDay, value, selectedYear);
    } else if (columnIndex === 2) {
      // Year changed
      setSelectedYear(value);
      notifyChange(selectedDay, selectedMonth, value);
    }
  };

  const notifyChange = (day: string, month: string, year: string) => {
    const monthIndex = MONTHS.indexOf(month) + 1;
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);

    // Validate the date
    const daysInMonth = getDaysInMonth(monthIndex, yearNum);
    const validDay = Math.min(dayNum, daysInMonth);

    // Format as YYYY-MM-DD
    const formattedDate = `${yearNum}-${monthIndex.toString().padStart(2, '0')}-${validDay.toString().padStart(2, '0')}`;
    onChange(formattedDate);
  };

  return (
    <ScrollPicker
      columns={columns}
      onValueChange={handleValueChange}
      initialValues={[selectedDay, selectedMonth, selectedYear]}
      disabled={disabled}
    />
  );
}

// Helper function to get days in a month
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}
