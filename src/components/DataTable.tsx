import React from 'react';
import styles from './DataTable.module.css';

interface DataTableProps {
  data: any[];
  // NEW: Add an optional prop to specify the column order
  columnOrder?: string[]; 
  isPlanetTable?: boolean;
}

// NEW: A helper function to format header titles nicely
const formatHeader = (key: string) => {
  return key
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize each word
};

export default function DataTable({ data, columnOrder, isPlanetTable }: DataTableProps) {
  // Handle cases where there is no data or an error message from the backend
  if (!data || data.length === 0) {
    return <p style={{ padding: '2rem', textAlign: 'center' }}>No data available for this table.</p>;
  }
  if (data[0] && (data[0].Error || data[0].Info)) {
    const key = Object.keys(data[0])[0];
    return <p style={{ padding: '2rem', textAlign: 'center' }}>{data[0][key]}</p>;
  }

  // --- MODIFIED LOGIC ---
  // If a columnOrder prop is provided, use it. Otherwise, infer from the first object.
  const headers = columnOrder ? columnOrder : Object.keys(data[0]);
  // --- END MODIFICATION ---

  return (
    <div className={styles.tableWrapper}>
      <table className={`${styles.table} ${isPlanetTable ? styles.stickyColumns : ''}`}>
        <thead className={styles.thead}>
          <tr>
            {headers.map(header => (
              <th className={styles.th} key={header}>
                {formatHeader(header)} {/* Use the new formatting function */}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map(header => (
                <td className={styles.td} key={`${rowIndex}-${header}`}>
                  {String(row[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}