import React, { useState, useEffect, useMemo } from 'react';
import styles from './AstroDataTables.module.css';
import DataTable from './DataTable';
import AstrologyChart from './AstrologyChart';
import DashaTable from './DashaTable';
import { DESCRIPTIVE_CONTENT } from './AstroDataTables.content';
import ConsultationCTA from './ConsultationCTA';

const DOSHA_DESCRIPTIONS = {
  "Mangal Dosh": "A planetary placement of Mars that can influence energy, assertiveness, and marital harmony.",
  "Kaal Sarp Dosh": "A condition where all planets are situated between the karmic nodes Rahu and Ketu, potentially causing life-path delays or intensification.",
  "Current Sade Sati": "The 7.5-year transit of Saturn over the natal Moon, often a period of significant life lessons, discipline, and restructuring.",
  "Pitra Dosh": "A karmic debt related to ancestors, indicated by certain planetary placements, which can affect prosperity and family well-being."
};

// A self-contained hook to detect mobile viewport
function useViewport() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleWindowResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);
  return { isMobile: width <= 768 };
}

// A reusable Arrow Icon component
const ArrowIcon = ({ direction = 'right' }: { direction?: 'left' | 'right' }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: direction === 'left' ? 'rotate(180deg)' : 'none' }}
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const InfoHeader = ({ title, description }: { title: string; description: string }) => (
  <div className={styles.infoHeader}>
    <h3 className={styles.infoTitle}>{title}</h3>
    <p className={styles.infoDescription}>{description}</p>
  </div>
);

interface AstroDataTablesProps {
  chartData: {
    chart_data?: { north_chart_svg?: string; south_chart_svg?: string; };
    processed_tables?: {
      d1_planets: any[];
      yogas: any[];
      houses: any[];
      vimshottari_dasha: any[];
      divisional_charts: { [key: string]: any[] };
      planetary_aspects: any[];
      doshas: any[];
      divisional_chart_svgs?: { [key: string]: string };
    };
    ai_reports?: {
      yogas_llm?: any;
      [key: string]: any;
    };
  };
  profileName: string;
  current_transits: any[];
}

const SUB_TABS = [
  { key: 'birth_chart', label: 'Birth Chart' },
  { key: 'active_yogas', label: 'Active Yogas' },
  { key: 'vimshottari_dasha', label: 'Vimshottari Dasha' },
  { key: 'divisional_charts', label: 'Divisional Charts' },
];

export default function AstroDataTables({ chartData, profileName }: AstroDataTablesProps) {
  const { isMobile } = useViewport();

  const [activeSubTabIndex, setActiveSubTabIndex] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(SUB_TABS[0].key);

  const processed_tables = chartData?.processed_tables;
  const chart_data = chartData?.chart_data;
  // const yogas_llm = chartData?.ai_reports?.yogas_llm;
  const yogas = processed_tables?.yogas;

  const doshasWithDescriptions = useMemo(() => {
    if (!processed_tables?.doshas) return []; // Safety check

    // Use .map to create a new array with the 'Description' key added
    return processed_tables.doshas.map(dosha => ({
      ...dosha, // Copy the original keys ("Dosha", "Status")
      Description: DOSHA_DESCRIPTIONS[dosha.Dosha as keyof typeof DOSHA_DESCRIPTIONS] || 'No description available.'
    }));
  }, [processed_tables?.doshas]); // Dependency array ensures this only runs when dosha data changes

  const divisionalChartKeys = useMemo(() => {
    const PRIORITY_ORDER = ['chalit', 'moon', 'sun'];

    // Start with a base list
    const keys = [];

    // Add our new transit key ONLY if the data for it exists
    if (processed_tables?.current_transits && processed_tables.current_transits.length > 0) {
      keys.push('current_transit');
    }

    const otherKeys = Object.keys(processed_tables?.divisional_charts || {})
      .filter(key => key !== 'D1')
      .sort((a, b) => {
        const indexA = PRIORITY_ORDER.indexOf(a);
        const indexB = PRIORITY_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
      });

    return [...otherKeys, ...keys];
  }, [processed_tables?.divisional_charts, processed_tables?.current_transits]);

  const [activeDivChartIndex, setActiveDivChartIndex] = useState(0);
  const [activeDivChart, setActiveDivChart] = useState(divisionalChartKeys[0] || null);

  const handleNav = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' ? activeSubTabIndex + 1 : activeSubTabIndex - 1;
    if (newIndex >= 0 && newIndex < SUB_TABS.length) {
      setActiveSubTabIndex(newIndex);
      setActiveSubTab(SUB_TABS[newIndex].key);
    }
  };

  const handleDivChartNav = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' ? activeDivChartIndex + 1 : activeDivChartIndex - 1;
    if (newIndex >= 0 && newIndex < divisionalChartKeys.length) {
      setActiveDivChartIndex(newIndex);
      setActiveDivChart(divisionalChartKeys[newIndex]);
    }
  };

  useEffect(() => {
    const newIndex = divisionalChartKeys.indexOf(activeDivChart);
    if (newIndex !== -1) setActiveDivChartIndex(newIndex);
  }, [activeDivChart, divisionalChartKeys]);


  if (!processed_tables || !chart_data) {
    // This case should rarely be seen now, as ReportsPage has its own LoadingPage
    return <p>Processing astrological data...</p>;
  }

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'birth_chart':
        return (
          <>
            <div className={styles.chartsContainer}>
              <div className={styles.chartBlock}>
                <InfoHeader {...DESCRIPTIVE_CONTENT.d1Chart} />
                <AstrologyChart svgString={chart_data?.north_chart_svg} title="Lagna (D1) Chart" />
              </div>
              <div className={styles.chartBlock}>
                <InfoHeader {...DESCRIPTIVE_CONTENT.d9Chart} />
                <AstrologyChart
                  svgString={processed_tables?.divisional_chart_svgs?.['D9_svg']}
                  title="Navamsa (D9) Chart"
                />
              </div>
            </div>

            <InfoHeader {...DESCRIPTIVE_CONTENT.planetaryDetails} />
            <div className={styles.tableContainer}>
              <DataTable data={processed_tables.d1_planets} isPlanetTable={true} />
            </div>

            <InfoHeader {...DESCRIPTIVE_CONTENT.houseDetails} />
            <div className={styles.tableContainer}>
              <DataTable data={processed_tables.houses} />
            </div>

          </>
        );

      case 'active_yogas': {
        // 1. Try to get New Data (API)
        const newYogas = processed_tables?.yogas;
        
        // 2. Try to get Old Data (LLM) - deep check to ensure it's an array
        const oldYogas = chartData?.ai_reports?.yogas_llm?.yogas;

        let displayData = [];
        let displayColumns: string[] = [];

        // 3. Determine which data to show
        if (newYogas && newYogas.length > 0 && !newYogas[0].Error) {
          // Case A: New API Data Found
          displayData = newYogas;
          // New keys are Title Case with spaces
          displayColumns = ['Yoga Name', 'Description']; 
        } 
        else if (oldYogas && Array.isArray(oldYogas) && oldYogas.length > 0) {
          // Case B: Old LLM Data Found (Fallback)
          displayData = oldYogas;
          // Old keys were snake_case
          displayColumns = ['yoga_name', 'description', 'reason', 'strength']; 
        }

        return (
          <>
            <InfoHeader {...DESCRIPTIVE_CONTENT.activeYogas} />
            
            {displayData.length > 0 ? (
              <div className={styles.tableContainer}>
                <DataTable
                  data={displayData}
                  columnOrder={displayColumns}
                />
              </div>
            ) : (
              <div className={styles.placeholder}>
                <p>No significant classical yogas were identified in this chart.</p>
              </div>
            )}

            <InfoHeader {...DESCRIPTIVE_CONTENT.doshasEvents} />
            <div className={styles.tableContainer}>
              <DataTable
                data={doshasWithDescriptions}
                columnOrder={['Dosha', 'Status', 'Description']}
              />
            </div>
          </>
        );
      }
      
      // ... other cases remain unchanged ...
      case 'vimshottari_dasha':
        return (
          <>
            <InfoHeader {...DESCRIPTIVE_CONTENT.vimshottariDasha} />
            <div className={styles.tableContainer}>
              <DashaTable data={processed_tables.vimshottari_dasha} />
            </div>
          </>
        );

      case 'divisional_charts': {
        const isTransitView = activeDivChart === 'current_transit';

        // Get content for regular divisional charts
        const lookupKey = isTransitView ? '' : activeDivChart.toUpperCase();
        const divChartContent = !isTransitView &&
          (DESCRIPTIVE_CONTENT.divisionalCharts[lookupKey as keyof typeof DESCRIPTIVE_CONTENT.divisionalCharts] ||
            DESCRIPTIVE_CONTENT.divisionalCharts.default);

        return (
          <>
            {/* The top navigation tabs remain the same */}
            {isMobile ? (
              <div className={styles.mobileNavContainer}>
                <button className={styles.navButton} onClick={() => handleDivChartNav('prev')} disabled={activeDivChartIndex === 0}> <ArrowIcon direction="left" /> </button>
                {/* Display a more user-friendly name for our new tab */}
                <span className={styles.currentTabLabel}>{isTransitView ? 'Current Transit' : divisionalChartKeys[activeDivChartIndex]}</span>
                <button className={styles.navButton} onClick={() => handleDivChartNav('next')} disabled={activeDivChartIndex === divisionalChartKeys.length - 1}> <ArrowIcon direction="right" /> </button>
              </div>
            ) : (
              <div className={styles.divisionalTabsContainer}>
                {divisionalChartKeys.map((key) => (<button key={key} className={`${styles.divisionalTabButton} ${activeDivChart === key ? styles.activeDivisionalTab : ""}`} onClick={() => setActiveDivChart(key)}> {key === 'current_transit' ? 'Current Transit' : key} </button>))}
              </div>
            )}

            {/* --- NEW CONDITIONAL RENDERING LOGIC --- */}
            {activeDivChart && (
              isTransitView ? (
                // --- RENDER FOR CURRENT TRANSIT VIEW ---
                <>
                  <InfoHeader {...DESCRIPTIVE_CONTENT.currentTransits} />
                  <div className={styles.chartsContainer}>
                    <AstrologyChart
                      svgString={processed_tables?.divisional_chart_svgs?.current_transit_svg}
                      title="Current Transit Chart"
                    />
                  </div>
                  <div className={styles.tableContainer}>
                    <DataTable data={processed_tables.current_transits} />
                  </div>
                </>
              ) : (
                // --- RENDER FOR REGULAR DIVISIONAL CHARTS (Existing Logic) ---
                <>
                  <InfoHeader title={divChartContent.title} description={divChartContent.description} />
                  {processed_tables?.divisional_chart_svgs?.[`${activeDivChart}_svg`] ? (
                    <div className={styles.chartsContainer}>
                      <AstrologyChart svgString={processed_tables.divisional_chart_svgs[`${activeDivChart}_svg`]} title={`Divisional Chart: ${activeDivChart.toUpperCase()}`} />
                    </div>
                  ) : processed_tables?.divisional_charts?.[activeDivChart]?.length > 0 ? (
                    <div className={styles.tableContainer}>
                      <p className={styles.fallbackNotice}>Chart image not available. Displaying table data.</p>
                      <DataTable data={processed_tables.divisional_charts[activeDivChart]} />
                    </div>
                  ) : (
                    <div className={styles.chartsContainer}>
                      <p>Data for the {activeDivChart} chart is not available.</p>
                    </div>
                  )}
                </>
              )
            )}
          </>
        );
      }
      default: return null;
    }
  };

  return (
    <>
      <div className={styles.container}>
        {isMobile ? (
          <div className={styles.mobileNavContainer}>
            <button className={styles.navButton} onClick={() => handleNav('prev')} disabled={activeSubTabIndex === 0}> <ArrowIcon direction="left" /> </button>
            <span className={styles.currentTabLabel}>{SUB_TABS[activeSubTabIndex].label}</span>
            <button className={styles.navButton} onClick={() => handleNav('next')} disabled={activeSubTabIndex === SUB_TABS.length - 1}> <ArrowIcon direction="right" /> </button>
          </div>
        ) : (
          <div className={styles.subTabsContainer}>
            {SUB_TABS.map((tab, index) => (<button key={tab.key} className={`${styles.subTabButton} ${activeSubTab === tab.key ? styles.activeSubTab : ''}`} onClick={() => { setActiveSubTab(tab.key); setActiveSubTabIndex(index); }} > {tab.label} </button>))}
          </div>
        )}

        <div className={styles.subTabContent}>
          {renderSubTabContent()}
        </div>
      </div>
      <ConsultationCTA />
    </>
  );
}