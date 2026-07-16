import React from 'react';
import styles from './AstrologyChart.module.css';

interface AstrologyChartProps {
  svgString: string | undefined;
  title: string;
}

export default function AstrologyChart({ svgString, title }: AstrologyChartProps) {
  if (!svgString) {
    return null;
  }

  if (svgString.includes('out of api calls') || svgString.includes('renew subscription') || svgString.includes('error')) {
    return null;
  }

  // --- SVG MODIFICATION LOGIC ---
  let modifiedSvg = svgString;

  // 1. Make the background transparent. (No changes here)
  modifiedSvg = modifiedSvg.replace(
    /<rect width="100%" height="100%" fill="white"\/>/,
    '<rect width="100%" height="100%" fill="transparent"/>'
  );

  // 2. Change all dark colors to white. (No changes here)
  const colorsToReplaceRegex = /black|#000000|#000|#1F222E|#919191/gi;
  modifiedSvg = modifiedSvg.replace(colorsToReplaceRegex, 'white');

  // 3. --- THE FIX: Increase ALL Font Sizes ---
  // Define the desired new font size for all text elements.
  const newFontSize = '18px'; 

  // This is a much simpler and more robust regex.
  // It finds every instance of 'font-size: 12.6px;' and replaces it.
  // The 'g' flag is crucial - it ensures ALL occurrences are replaced, not just the first.
  const fontSizeRegex = /font-size:\s*12\.6px;/g;

  modifiedSvg = modifiedSvg.replace(fontSizeRegex, `font-size: ${newFontSize};`);
  
  // --- END OF MODIFICATION LOGIC ---

  const dataUri = `data:image/svg+xml;base64,${btoa(modifiedSvg)}`;

  return (
    <div className={styles.chartContainer}>
      <h4 className={styles.chartTitle}>{title}</h4>
      <img src={dataUri} alt={title} className={styles.chartImage} />
    </div>
  );
}