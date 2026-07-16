import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { supabase } from '../supabaseClient';
import styles from './ReportsPage.module.css';

// Import all necessary components
import { useLocation } from "react-router-dom";
import AstroDataTables from '../components/AstroDataTables';
import LoadingPage from '../components/LoadingPage';
import MobileProfileSelector from '../components/MobileProfileSelector';
import { EnrichedProfile } from '../components/ProfileCard';
import ReportTabs from '../components/ReportTabs';
import { handleNotificationDeepLink } from '../utils/deepLinkHandler';

import AiInsightsDisplay from '../components/AiInsightsDisplay';
import ConfirmationModal, { ConfirmationData } from '../components/ConfirmationModal';
import SubscriptionModal from '../components/SubscriptionModal';
import { trackEvent } from '../utils/analytics';

import {
  TiBriefcase,
  TiCalendar,
  TiChartBar,
  TiCompass,
  TiHeart,
  TiHome,
  TiKey,
  TiLeaf,
  TiWaves
} from 'react-icons/ti';


function useViewport() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleWindowResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);
  return { isMobile: width <= 768 };
}

// --- Interface Definitions ---
interface ChartData {
  north_chart_svg?: string;
  south_chart_svg?: string;
  [key: string]: any;
}

interface ProcessedTables {
  d1_planets: any[];
  houses: any[];
  yogas: any[];
  vimshottari_dasha: any[];
  divisional_charts: { [key: string]: any[] };
  planetary_aspects: any[];
  doshas: any[];
  jaimini_karakas: any[];
  remedies: any[];
  current_transits: any[];
  [key: string]: any;
}

interface AiReports {
  yogas_llm?: any;
  [key: string]: any;
}

interface BaseReportData {
  chart_data?: ChartData;
  processed_tables?: ProcessedTables;
  ai_reports?: AiReports;
}

export default function ReportsPage() {
  const { isMobile } = useViewport();
  const { user, refreshUserStatus, planTier, canAddProfile, isSubscribed, walletBalance, coinBalance, updateWalletBalance } = useAuth();
  const { prices, formatPrice, variant: monetizationVariant } = usePricing();
  const { userProfiles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();


  // --- State Variables ---
  const [profiles, setProfiles] = useState<EnrichedProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<EnrichedProfile | null>(null);
  const [baseReportData, setBaseReportData] = useState<BaseReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('charts');
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
  const [loadingReportKey, setLoadingReportKey] = useState<string | null>(null);

  // --- 1. UPDATED CATALOG: Added 'serviceKey' to map to DB prices ---
  const reportCatalog = [
    {
      category: "Free Report",
      reports: [
        {
          key: 'basic_life_insight',
          serviceKey: 'report_basic', // Matches DB
          title: 'Basic Life Insight Report',
          description: 'An introduction to your chart\'s unique blueprint, core personality, major life themes, and key strengths.',
          icon: <TiKey size={28} />
        },
      ]
    },
    {
      category: "Life & Future Insights",
      reports: [
        {
          key: 'life_forecast_12_month',
          serviceKey: 'report_premium', // Matches DB
          title: 'Life Forecast Report (12-Month)',
          description: 'A 12-month predictive overview blending dasha cycles and transits to identify opportunities and caution periods.',
          icon: <TiCalendar size={28} />
        },
        {
          key: 'destiny_blueprint',
          serviceKey: 'report_premium',
          title: 'Destiny Blueprint (Lifetime Report)',
          description: 'Your complete life manual. A deep dive into your personality, purpose, karmic design, and lifetime potential.',
          icon: <TiCompass size={28} />
        },
      ]
    },
    {
      category: "Career & Wealth",
      reports: [
        {
          key: 'career_mastery',
          serviceKey: 'report_premium',
          title: 'Career Mastery Report',
          description: 'A comprehensive guide to your ideal career path, professional strengths, and the best timing for growth and success.',
          icon: <TiBriefcase size={28} />
        },
        {
          key: 'wealth_prosperity',
          serviceKey: 'report_premium',
          title: 'Wealth & Prosperity Report',
          description: 'Uncover your financial potential, wealth-building capacity, and the key periods for long-term abundance.',
          icon: <TiChartBar size={28} />
        },
      ]
    },
    {
      category: "Love & Relationships",
      reports: [
        {
          key: 'love_marriage',
          serviceKey: 'report_premium',
          title: 'Love & Marriage Report',
          description: 'Explore your love patterns, relationship dynamics, marriage destiny, and the timing of significant romantic events.',
          icon: <TiHeart size={28} />
        },
      ]
    },
    {
      category: "Health & Wellbeing",
      reports: [
        {
          key: 'health_vitality',
          serviceKey: 'report_premium',
          title: 'Health & Vitality Report',
          description: 'Understand your body\'s unique constitution, potential health vulnerabilities, and periods of high vitality.',
          icon: <TiWaves size={28} />
        },
        {
          key: 'mind_inner_peace',
          serviceKey: 'report_premium',
          title: 'Mind & Inner Peace Report',
          description: 'A roadmap to your emotional and mental landscape, identifying patterns for stress and periods of inner calm.',
          icon: <TiLeaf size={28} />
        }
      ]
    },
    {
      category: "Soul, Family & Karma",
      reports: [
        {
          key: 'karma_life_purpose',
          serviceKey: 'report_premium',
          title: 'Karma & Life Purpose Report',
          description: 'Decode your spiritual path and karmic journey by analyzing past-life lessons and your soul\'s destiny.',
          icon: <TiCompass size={28} />
        },
        {
          key: 'family_home_prosperity',
          serviceKey: 'report_premium',
          title: 'Family, Home & Prosperity Report',
          description: 'Insights into domestic peace, family dynamics, and auspicious timing for property or home-related matters.',
          icon: <TiHome size={28} />
        }
      ]
    }
  ];

  const allReports = reportCatalog.flatMap(category => category.reports);
  const [viewingReport, setViewingReport] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (selectedProfile) {
      trackEvent('Reports Tab Visited', {
        tab_name: activeTab,
        profile_id: selectedProfile.id,
        profile_name: selectedProfile.name
      });
    }
  }, [activeTab, selectedProfile]);

  useEffect(() => {
    if (location.state?.fromProceed) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'NOTIFICATION_CLICKED') return;
      handleNotificationDeepLink(data.data, (path: string) => navigate(path));
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) return;
      setLoadingProfiles(true);
      setError(null);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, user_birth_details(*)')
        .eq('user_id', user.id)
        .order('id', { ascending: false });
      if (error) {
        setError('Failed to load your profiles. Please try again.');
      } else {
        const enrichedData = (data || []).map(profile => {
          const birthDetails = Array.isArray(profile.user_birth_details) ? profile.user_birth_details[0] : profile.user_birth_details;
          return { id: profile.id, name: profile.name, gender: birthDetails?.gender || 'N/A', date_of_birth: birthDetails?.date_of_birth || '', time_of_birth: birthDetails?.time_of_birth || '', birth_place: birthDetails?.birth_place || 'N/A' };
        }) as EnrichedProfile[];
        setProfiles(enrichedData);
        if (!isMobile && enrichedData.length === 1 && !selectedProfile) {
          handleProfileSelect(enrichedData[0]);
        }
      }
      setLoadingProfiles(false);
    };
    fetchProfiles();
  }, [user?.id, isMobile]);

  useEffect(() => {
    const fetchBaseData = async () => {
      if (!selectedProfile) return;
      setLoadingReport(true);
      setError(null);
      setBaseReportData(null);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('generate-astro-data', {
          body: {
            profile_id: selectedProfile.id,
            scope: 'charts'
          }
        });
        if (invokeError) throw invokeError;
        setBaseReportData(data);
      } catch (err: any) {
        setError(err.body?.error || err.message || 'Failed to generate report.');
      } finally {
        setLoadingReport(false);
      }
    };
    fetchBaseData();
  }, [selectedProfile]);

  useEffect(() => {
    if (!profiles || profiles.length === 0) return;
    const newlyCreatedId = location.state?.newlyCreatedProfileId;
    if (newlyCreatedId) {
      const newProfile = profiles.find(p => p.id === newlyCreatedId);
      if (newProfile) {
        handleProfileSelect(newProfile);
        return;
      }
    }
    if (!selectedProfile) {
      handleProfileSelect(profiles[0]);
    }
  }, [profiles, selectedProfile, location.state]);

  const handleUnlockReport = async (reportType: string, coinCost: number) => {
    setConfirmationData(null);
    trackEvent('AI Report Generation Confirmed', {
      report_type: reportType,
      coin_cost: coinCost,
      profile_id: selectedProfile?.id,
      monetization_variant: monetizationVariant
    });
    if (!selectedProfile) return;
    setLoadingReportKey(reportType);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('test-generate-astro-data', {
        body: {
          profile_id: selectedProfile.id,
          scope: 'ai',
          report_type: reportType,
          monetization_variant: monetizationVariant // <-- SEND THE VARIANT TO THE BACKEND
        }
      });
      if (invokeError) throw invokeError;
      // 2. INSTANT UI UPDATE (Optimistic)
      // 'coinCost' is passed from the modal, which calculated it correctly based on prices
      if (walletBalance !== null && coinCost > 0) {
        updateWalletBalance(walletBalance - coinCost);
      }

      // 3. Update Report Data
      if (data) setBaseReportData(data);

      // 4. BACKGROUND SYNC
      // await refreshUserStatusSilent();

    } catch (err: any) {
      const errorMessage = err.body?.error || err.message || '';
      if (errorMessage.includes('Insufficient coins')) {
        setSubscriptionModalOpen(true);
      } else {
        setError(errorMessage || 'An unknown error occurred during report generation.');
      }
    } finally {
      setLoadingReportKey(null);
    }
  };

  // --- 2. UPDATED CONFIRMATION HANDLER: Takes formatted display cost ---
  const handleOpenConfirmation = (reportData: { key: string; title: string; effectiveCost: number; displayCost: string }) => {
    trackEvent('AI Report Unlock Started', {
      report_type: reportData.key,
      coin_cost: reportData.effectiveCost,
      effective_cost: reportData.effectiveCost
    });

    setConfirmationData({
      reportKey: reportData.key,
      title: reportData.title,
      cost: reportData.effectiveCost, // Logic needs numeric
      displayCost: reportData.displayCost // Modal needs string
    });
  };

  const handleProfileSelect = (profile: EnrichedProfile) => {
    if (selectedProfile?.id !== profile.id) {
      setLoadingReport(true);
      setBaseReportData(null);
      setError(null);
      setSubscriptionModalOpen(false);
      setViewingReport(null);
    }
    setSelectedProfile(profile);
    setActiveTab('tables');
  };

  const renderReportContent = () => {
    if (loadingReport) return <LoadingPage />;
    if (!baseReportData) return <div className={styles.placeholder}><p>Report data will appear here.</p></div>;

    switch (activeTab) {
      case 'tables':
        return (
          <AstroDataTables
            chartData={baseReportData}
            profileName={selectedProfile?.name || 'Profile'}
          />
        );
      case 'ai':
        // --- 3. UPDATED RENDER LOGIC: Calculates dynamic prices inside the loop ---
        return (
          <div className={styles.reportGrid}>
            {allReports.map(report => {
              const isUnlocked = !!baseReportData?.ai_reports?.[report.key];
              const isLoading = loadingReportKey === report.key;

              // 1. Get raw price from Context (fallback to 0)
              const rawCost = prices[report.serviceKey] ?? prices['report_premium'] ?? 0;

              // 2. Determine "Effective" Cost (Free for Premium Users?)
              const isPremiumUser = isSubscribed;
              const isEffectiveFree = isPremiumUser && report.serviceKey === 'report_premium';

              // 3. Determine the final numeric cost and string to display
              const finalCost = isEffectiveFree ? 0 : rawCost;
              const displayCostString = isEffectiveFree ? 'Free with Premium' : (finalCost === 0 ? 'Free' : formatPrice(finalCost));

              return (
                <div key={report.key} className={`${styles.reportCard} ${isLoading ? styles.loadingCard : ''}`}>
                  <div className={styles.cardHeader}>
                    {report.icon && (
                      <div className={styles.cardIconContainer}>
                        {report.icon}
                      </div>
                    )}
                    <h4>{report.title}</h4>
                  </div>
                  <p>{report.description}</p>
                  <div className={styles.cardFooter}>
                    {isUnlocked ? (
                      <button className={styles.viewButton} onClick={() => setViewingReport({ title: report.title, content: baseReportData.ai_reports[report.key] })}>
                        View Report
                      </button>
                    ) : (
                      <button
                        className={styles.unlockButton}
                        onClick={() => handleOpenConfirmation({
                          key: report.key,
                          title: report.title,
                          effectiveCost: finalCost,
                          displayCost: displayCostString
                        })}
                        disabled={!!loadingReportKey}
                      >
                        {isLoading ? (
                          <>
                            <span className={styles.buttonSpinner}></span>
                            <span>Generating...</span>
                          </>
                        ) : (
                          // Button text logic
                          (finalCost > 0) ? `Unlock (${formatPrice(finalCost)})` : (isEffectiveFree ? 'Free with Premium' : 'Generate Free Report')
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {viewingReport && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                  <button className={styles.modalClose} onClick={() => setViewingReport(null)}>×</button>
                  <div className={styles.modalBody}>
                    <AiInsightsDisplay insights={{ analyst_report: viewingReport.content }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const handleAddProfileClick = (e: React.MouseEvent) => {
    trackEvent('Add New Profile Clicked', {
      source: 'Reports Page',
      plan_tier: planTier,
      current_profile_count: userProfiles?.length ?? 0,
      can_add_profile: canAddProfile,
    });

    if (!canAddProfile) {
      e.preventDefault();
      setSubscriptionModalOpen(true);
    }
  };

  useEffect(() => {
    const hash = location.hash;
    if (hash === '#ai') {
      setActiveTab('ai');
    } else if (hash === '#tables') {
      setActiveTab('tables');
    }
  }, [location])

  return (
    <div className={styles.pageContainer}>
      <SubscriptionModal isOpen={isSubscriptionModalOpen} onClose={() => setSubscriptionModalOpen(false)} />
      <ConfirmationModal
        isOpen={!!confirmationData}
        onClose={() => setConfirmationData(null)}
        onConfirm={handleUnlockReport}
        data={confirmationData}
        walletBalance={walletBalance}
      />

      <main className={styles.contentArea}>
        <div className={styles.contentColumn}>
          <h1 className={styles.pageTitle}>Reports & Insights</h1>
          <div className={styles.pageHeader}>
            {/* FIX: Only render the selector if profiles exist. 
                This hides the top "Add Profile" button when the list is empty,
                leaving only the large dashboard button below. */}
            {profiles.length > 0 && (
              <MobileProfileSelector
                profiles={profiles}
                selectedProfileId={selectedProfile?.id || null}
                onProfileSelect={handleProfileSelect}
                onAddProfileClick={handleAddProfileClick}
              />
            )}
            
            <ReportTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div className={styles.reportWrapper}>
            {error && <p style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}><strong>Error:</strong> {error}</p>}
            {loadingProfiles ? (
              <LoadingPage />
            ) : profiles.length === 0 ? (
              <div className={styles.placeholder}>
                <h2>Welcome to Your Cosmic Dashboard</h2>
                <p>Add your birth details to generate your first astrology report and unlock your insights.</p>
                <Link
                  to="/profiles/new"
                  className={styles.ctaButton}
                  onClick={handleAddProfileClick}
                >
                  Add Your First Profile
                </Link>
              </div>
            ) : selectedProfile ? (
              <>
                {renderReportContent()}
              </>
            ) : (
              <LoadingPage />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}