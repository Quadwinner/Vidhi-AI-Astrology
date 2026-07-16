// src/components/ScrollPicker.tsx
import React, { useRef, useEffect, useState } from 'react';
import styles from './ScrollPicker.module.css';

export interface PickerColumn {
  id: string;
  values: string[];
  label?: string;
  selectedValue?: string;
}

interface ScrollPickerProps {
  columns: PickerColumn[];
  onValueChange: (columnIndex: number, value: string) => void;
  initialValues?: string[];
  disabled?: boolean;
  className?: string;
}

const ITEM_HEIGHT = 28;
const VISIBLE_ITEMS = 5;

export default function ScrollPicker({
  columns,
  onValueChange,
  initialValues = [],
  disabled = false,
  className = '',
}: ScrollPickerProps) {
  return (
    <div className={`${styles.pickerContainer} ${disabled ? styles.disabled : ''} ${className}`}>
      <div className={styles.pickerColumns}>
        {columns.map((column, index) => (
          <ScrollColumn
            key={column.id}
            column={column}
            columnIndex={index}
            initialValue={initialValues[index] || column.selectedValue || column.values[0]}
            onValueChange={onValueChange}
            disabled={disabled}
          />
        ))}
      </div>
      <div className={styles.selectionHighlight} />
    </div>
  );
}

interface ScrollColumnProps {
  column: PickerColumn;
  columnIndex: number;
  initialValue: string;
  onValueChange: (columnIndex: number, value: string) => void;
  disabled: boolean;
}

function ScrollColumn({ column, columnIndex, initialValue, onValueChange, disabled }: ScrollColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [isFocused, setIsFocused] = useState(false);

  // Initialize scroll position based on initial value
  useEffect(() => {
    const index = column.values.indexOf(initialValue);
    if (index !== -1) {
      setSelectedIndex(index);
      scrollToIndex(index, false);
    }
  }, [initialValue, column.values]);

  const scrollToIndex = (index: number, smooth: boolean = true) => {
    if (!scrollRef.current) return;
    
    const scrollTop = index * ITEM_HEIGHT;
    scrollRef.current.scrollTo({
      top: scrollTop,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current || disabled) return;

    setIsScrolling(true);
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Calculate current index based on scroll position
    const scrollTop = scrollRef.current.scrollTop;
    const currentIndex = Math.round(scrollTop / ITEM_HEIGHT);
    
    // Set timeout to detect scroll end
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      snapToNearest();
    }, 150);
  };

  const snapToNearest = () => {
    if (!scrollRef.current) return;

    const scrollTop = scrollRef.current.scrollTop;
    const nearestIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(nearestIndex, column.values.length - 1));

    setSelectedIndex(clampedIndex);
    scrollToIndex(clampedIndex, true);
    onValueChange(columnIndex, column.values[clampedIndex]);
  };

  // Mouse/Touch click handler for direct item selection
  const handleItemClick = (index: number) => {
    if (disabled) return;
    
    setSelectedIndex(index);
    scrollToIndex(index, true);
    onValueChange(columnIndex, column.values[index]);
  };



  // Calculate opacity based on distance from center
  const getItemStyle = (index: number): React.CSSProperties => {
    if (!scrollRef.current) return {};

    const scrollTop = scrollRef.current.scrollTop;
    const centerIndex = scrollTop / ITEM_HEIGHT;
    const distance = Math.abs(index - centerIndex);

    let opacity = 1;
    let scale = 1;

    if (distance < 1) {
      opacity = 1 - distance * 0.4;
      scale = 1 + (1 - distance) * 0.1;
    } else if (distance < 2) {
      opacity = 0.6 - (distance - 1) * 0.3;
      scale = 1;
    } else {
      opacity = 0.3;
      scale = 1;
    }

    return {
      opacity,
      transform: `scale(${scale})`,
    };
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);
      scrollToIndex(newIndex, true);
      onValueChange(columnIndex, column.values[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(column.values.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);
      scrollToIndex(newIndex, true);
      onValueChange(columnIndex, column.values[newIndex]);
    }
  };

  return (
    <div className={styles.column}>
      {column.label && <div className={styles.columnLabel} id={`${column.id}-label`}>{column.label}</div>}
      <div
        ref={scrollRef}
        className={`${styles.scrollArea} ${disabled ? styles.disabled : ''} ${isFocused ? styles.focused : ''}`}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={disabled ? -1 : 0}
        role="listbox"
        aria-label={column.label || column.id}
        aria-labelledby={column.label ? `${column.id}-label` : undefined}
        aria-activedescendant={`${column.id}-item-${selectedIndex}`}
      >
        {/* Padding items at top */}
        {Array.from({ length: Math.floor(VISIBLE_ITEMS / 2) }).map((_, i) => (
          <div key={`padding-top-${i}`} className={styles.item} style={{ opacity: 0 }} />
        ))}
        
        {/* Actual values */}
        {column.values.map((value, index) => (
          <div
            key={`${value}-${index}`}
            id={`${column.id}-item-${index}`}
            className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
            style={getItemStyle(index)}
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => handleItemClick(index)}
          >
            {value}
          </div>
        ))}
        
        {/* Padding items at bottom */}
        {Array.from({ length: Math.floor(VISIBLE_ITEMS / 2) }).map((_, i) => (
          <div key={`padding-bottom-${i}`} className={styles.item} style={{ opacity: 0 }} />
        ))}
      </div>
    </div>
  );
}
