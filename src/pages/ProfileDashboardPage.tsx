import {
  IconLayoutDashboard, IconChartArcs, IconMoonStars, IconHeart, IconStars,
  IconSettings, IconHelpCircle, IconArrowsMaximize, IconSun, IconMoon,
  IconInfinity, IconArrowRight, IconUser, IconPlus, IconPencil, IconBrightnessUp,
  IconLogout, IconFileText,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { EnrichedProfile } from '../components/ProfileCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { generateKundliPdf } from '../utils/kundliPdf';
import { generateKundliPdfHindi } from '../utils/kundliPdfHi';
import styles from './ProfileDashboardPage.module.css';

import EditProfileSection from '../components/EditProfileSection';
import LoadingDashboard from '../components/LoadingDashboard';
import UpgradeForProfilesModal from '../components/UpgradeForProfilesModal';

export default function ProfileDashboardPage() {
  const { user, userProfiles, checkingStatus, planTier, refreshUserStatus, signOut } = useAuth() as any;
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<EnrichedProfile[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [editingProfile, setEditingProfile] = useState<EnrichedProfile | null>(null);
  const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [chartSvg, setChartSvg] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const fetchBirthDetails = async () => {
      if (!userProfiles || userProfiles.length === 0) {
        setProfiles([]); setLoadingDetails(false);
        if (userProfiles?.length === 0) setEditingProfile(null);
        return;
      }
      setLoadingDetails(true);
      const ids = userProfiles.map((p: any) => p.id);
      const { data: birth, error } = await supabase.from('user_birth_details').select('*').in('profile_id', ids);
      if (error) { console.error('Error fetching birth details:', error); setLoadingDetails(false); return; }
      const enriched = userProfiles.map((profile: any) => {
        const d = birth.find((x: any) => x.profile_id === profile.id);
        return {
          id: profile.id, name: profile.name,
          gender: d?.gender || 'N/A',
          date_of_birth: d?.date_of_birth || '',
          time_of_birth: d?.time_of_birth || '',
          birth_place: d?.birth_place || 'N/A',
        };
      });
      setProfiles(enriched as EnrichedProfile[]);
      setLoadingDetails(false);
    };
    if (!checkingStatus) fetchBirthDetails();
  }, [userProfiles, checkingStatus]);

  // Load the real birth chart SVG for the primary profile.
  const primaryId = profiles[0]?.id;
  useEffect(() => {
    if (!primaryId) { setChartSvg(null); return; }
    let cancelled = false;
    setChartLoading(true);
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('generate-astro-data', {
          // Dashboard only renders the cached birth chart SVG; skip the live
          // VedicAstro transit fetch so revisiting the dashboard costs no API call.
          body: { profile_id: primaryId, scope: 'charts', skip_transits: true },
        });
        if (!cancelled) setChartSvg(data?.chart_data?.north_chart_svg || null);
      } catch (e) {
        if (!cancelled) setChartSvg(null);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [primaryId]);

  // Transform the stored SVG (transparent bg, light text) into a data URI.
  const chartUri = useMemo(() => {
    if (!chartSvg) return null;
    if (/out of api calls|renew subscription|error/i.test(chartSvg)) return null;
    try {
      let svg = chartSvg
        .replace(/<rect width="100%" height="100%" fill="white"\/>/, '<rect width="100%" height="100%" fill="transparent"/>')
        .replace(/black|#000000|#000|#1F222E|#919191/gi, '#e5e2df')
        .replace(/font-size:\s*12\.6px;/g, 'font-size: 16px;');
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    } catch {
      return null;
    }
  }, [chartSvg]);

  const handleProfileUpdate = async () => {
    if (refreshUserStatus) await refreshUserStatus();
    setEditingProfile(null);
  };

  const handleAddProfileClick = () => {
    if (planTier === 'yearly' || (userProfiles && userProfiles.length < 1)) navigate('/profiles/new');
    else setUpgradeModalOpen(true);
  };

  if (checkingStatus || loadingDetails) {
    return <div className={styles.pageLoader}><div className={styles.placeholder}><LoadingDashboard /></div></div>;
  }

  if (editingProfile) {
    return (
      <main className={styles.page}>
        <div className={styles.constellation} aria-hidden="true" />
        <div className={styles.editShell}>
          <EditProfileSection
            profile={editingProfile}
            currentUser={user}
            onBack={() => setEditingProfile(null)}
            onUpdate={handleProfileUpdate}
          />
        </div>
      </main>
    );
  }

  const primary = profiles[0];
  const firstName = (primary?.name || user?.user_metadata?.full_name || 'Seeker').split(' ')[0];
  const isPremium = planTier === 'monthly' || planTier === 'yearly';

  const handleDownloadPdf = async (lang: 'en' | 'hi' = 'en') => {
    if (!primary || pdfLoading) return;
    setPdfLoading(true);
    const toastId = toast.loading(lang === 'hi' ? 'हिंदी कुंडली तैयार हो रही है…' : 'Preparing your Kundli PDF…');
    try {
      const { data, error } = await supabase.functions.invoke('generate-astro-data', {
        body: { profile_id: primary.id, scope: 'charts', skip_transits: true },
      });
      if (error) throw new Error(error.message);
      if (!data?.processed_tables) throw new Error('Chart data is not ready yet. Please try again shortly.');
      if (lang === 'hi') await generateKundliPdfHindi(primary, data);
      else await generateKundliPdf(primary, data);
      toast.success(lang === 'hi' ? 'कुंडली PDF डाउनलोड हो गई' : 'Kundli PDF downloaded', { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || 'Could not generate the PDF. Please try again.', { id: toastId });
    } finally {
      setPdfLoading(false);
    }
  };
  const tierLabel = planTier === 'yearly' ? 'Celestial Tier' : planTier === 'monthly' ? 'Ascendant Tier' : 'Free Tier';

  const navItems = [
    { icon: <IconLayoutDashboard size={22} />, label: 'Cosmic Dashboard', active: true, onClick: () => {} },
    { icon: <IconChartArcs size={22} />, label: 'Birth Chart', onClick: () => navigate('/reports') },
    { icon: <IconMoonStars size={22} />, label: 'Transits', onClick: () => navigate('/reports') },
    { icon: <IconHeart size={22} />, label: 'Compatibility', onClick: () => navigate('/reports') },
    { icon: <IconStars size={22} />, label: 'Vidhi Premium', onClick: () => navigate('/quick-recharge') },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.constellation} aria-hidden="true" />
      <UpgradeForProfilesModal isOpen={isUpgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />

      {/* Side navigation (desktop) */}
      <nav className={styles.sidenav}>
        <div className={styles.sidenavHead}>
          <div className={styles.sideProfile}>
            <div className={styles.sideAvatar}><IconUser size={22} /></div>
            <div>
              <h2 className={styles.sideName}>{primary?.name || firstName}</h2>
              <p className={styles.sidePath}>Vedic path • {tierLabel}</p>
            </div>
          </div>
          <button className={styles.upgradeBtn} onClick={() => navigate('/quick-recharge')}>
            <IconStars size={18} /><span>{isPremium ? 'Manage membership' : 'Upgrade tier'}</span>
          </button>
        </div>

        <div className={styles.navList}>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`${styles.navItem} ${item.active ? styles.navActive : ''}`}
              onClick={item.onClick}
            >
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.navFooter}>
          <button className={styles.navItemSm} onClick={() => setEditingProfile(primary || null)} disabled={!primary}>
            <IconSettings size={20} /><span>Profile settings</span>
          </button>
          <button className={styles.navItemSm} onClick={() => navigate('/#faq')}>
            <IconHelpCircle size={20} /><span>Support</span>
          </button>
          <button className={styles.navItemSm} onClick={() => signOut()}>
            <IconLogout size={20} /><span>Sign out</span>
          </button>
        </div>
      </nav>

      {/* Main canvas */}
      <div className={styles.canvas}>
        <div className={styles.dashHead}>
          <div>
            <h1 className={styles.dashTitle}>Astral Dashboard</h1>
            <p className={styles.dashSub}>Welcome to your spiritual command center, {firstName}. The cosmos align favorably today.</p>
          </div>
          <div className={styles.livePill}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span>Live Cosmic Data</span>
          </div>
        </div>

        <div className={styles.bento}>
          {/* Kundli visualization */}
          <section className={`${styles.panel} ${styles.kundli}`}>
            <div className={styles.kundliHead}>
              <div>
                <h2 className={styles.panelTitle}>Kundli Visualization</h2>
                <p className={styles.panelSub}>Real-time planetary alignment</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.iconBtn} onClick={() => handleDownloadPdf('en')} disabled={!primary || pdfLoading} aria-label="Download Kundli PDF" title="Download full Kundli PDF">
                  <IconFileText size={20} />
                </button>
                <button className={styles.iconBtn} onClick={() => navigate('/reports')} aria-label="Open chart">
                  <IconArrowsMaximize size={20} />
                </button>
              </div>
            </div>
            <div className={styles.chartStage}>
              <div className={`${styles.ring} ${styles.ringOuter}`} />
              <div className={`${styles.ring} ${styles.ringMid}`} />
              <div className={styles.coreGlow} />
              {chartUri ? (
                <img className={styles.chartImg} src={chartUri} alt="Birth chart (Kundli)" />
              ) : (
                <>
                  <span className={`${styles.node} ${styles.nodeGold}`} style={{ top: 8, left: '50%' }} />
                  <span className={`${styles.node} ${styles.nodePink}`} style={{ bottom: 40, right: 60 }} />
                  <span className={`${styles.node} ${styles.nodeBlue}`} style={{ left: 40, top: '38%' }} />
                  <div className={styles.chartCenter}>
                    <IconBrightnessUp size={54} />
                    <p>{chartLoading ? 'Generating your chart…' : primary ? 'Chart unavailable' : 'Add a profile to view your chart'}</p>
                  </div>
                </>
              )}
            </div>
            <div className={styles.kundliPdfRow}>
              <button className={styles.kundliPdfBtn} onClick={() => handleDownloadPdf('en')} disabled={!primary || pdfLoading}>
                <IconFileText size={18} />
                {pdfLoading ? 'Preparing…' : 'Download PDF (English)'}
              </button>
              <button className={`${styles.kundliPdfBtn} ${styles.kundliPdfBtnAlt}`} onClick={() => handleDownloadPdf('hi')} disabled={!primary || pdfLoading}>
                <IconFileText size={18} />
                {pdfLoading ? 'तैयार…' : 'हिंदी PDF'}
              </button>
            </div>
          </section>

          {/* Right column */}
          <div className={styles.rightCol}>
            <section className={`${styles.panel} ${styles.profileCard}`} onClick={() => primary && setEditingProfile(primary)}>
              <span className={styles.profileGlow} aria-hidden="true" />
              <div className={styles.profileTop}>
                <div className={styles.profileAvatarRing}>
                  <div className={styles.profileAvatar}><IconUser size={28} /></div>
                </div>
                <div>
                  <h3 className={styles.profileName}>{primary?.name || firstName}</h3>
                  <p className={styles.profileRole}>Primary Entity</p>
                </div>
                {primary && (
                  <button className={styles.editFloat} onClick={(e) => { e.stopPropagation(); setEditingProfile(primary); }} aria-label="Edit profile">
                    <IconPencil size={16} />
                  </button>
                )}
              </div>
              <div className={styles.tierCard}>
                <div className={styles.tierRow}>
                  <span className={styles.tierLabel}><IconStars size={15} /> {tierLabel}</span>
                  <span className={styles.tierState}>{isPremium ? 'Active' : 'Free'}</span>
                </div>
                <div className={styles.tierBar}><span style={{ width: isPremium ? '78%' : '18%' }} /></div>
                <p className={styles.tierHint}>{isPremium ? '78% to Ascended tier' : 'Upgrade to unlock premium'}</p>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.transits}`}>
              <div className={styles.transHead}>
                <h3 className={styles.panelTitle}>Current Transits</h3>
                <IconMoonStars size={20} className={styles.mutedIcon} />
              </div>
              <div className={styles.transList}>
                <div className={styles.transItem}>
                  <div className={`${styles.transIcon} ${styles.transIconMaroon}`}><IconSun size={20} /></div>
                  <div className={styles.transInfo}>
                    <h4>Sun enters Leo</h4>
                    <p>Peak vitality & expression</p>
                  </div>
                  <span className={styles.transTag}>+2.4h</span>
                </div>
                <div className={styles.transItem}>
                  <div className={`${styles.transIcon} ${styles.transIconBlue}`}><IconMoon size={20} /></div>
                  <div className={styles.transInfo}>
                    <h4>Moon trine Venus</h4>
                    <p>Emotional harmony</p>
                  </div>
                  <span className={styles.transTag}>Now</span>
                </div>
              </div>
              <button className={styles.ghostBtn} onClick={() => navigate('/reports')}>
                View all transits <IconArrowRight size={16} />
              </button>
            </section>
          </div>

          {/* Bottom widgets */}
          <div className={styles.bottomRow}>
            <section className={`${styles.panel} ${styles.aura}`}>
              <div className={styles.auraRing}>
                <svg viewBox="0 0 100 100" className={styles.auraSvg}>
                  <circle cx="50" cy="50" r="46" className={styles.auraTrack} />
                  <circle cx="50" cy="50" r="46" className={styles.auraProgress} strokeDasharray="289" strokeDashoffset="40" />
                </svg>
                <span className={styles.auraPct}>86%</span>
              </div>
              <div className={styles.auraInfo}>
                <h3 className={styles.panelTitle}>Aura Strength</h3>
                <p className={styles.panelSub}>Your energy field is exceptionally clear today — favorable for deep meditation.</p>
                <div className={styles.chipRow}>
                  <span className={styles.chipMaroon}>Clarity</span>
                  <span className={styles.chipGold}>Focus</span>
                </div>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.karmic}`}>
              <span className={styles.karmicGlow} aria-hidden="true" />
              <div className={styles.karmicHead}>
                <h3 className={styles.panelTitle}>Karmic Progress</h3>
                <IconInfinity size={22} className={styles.goldIcon} />
              </div>
              <div className={styles.karmicGrid}>
                <div className={styles.karmicStat}><b>12</b><span>Cycles</span></div>
                <div className={styles.karmicStat}><b className={styles.gold}>8</b><span>Lessons</span></div>
                <div className={styles.karmicStat}><b className={styles.blue}>4</b><span>Mastered</span></div>
              </div>
            </section>
          </div>
        </div>

        {/* Add profile floating action */}
        <button className={styles.fab} onClick={handleAddProfileClick} aria-label="Add profile">
          <IconPlus size={22} /><span>Add Profile</span>
        </button>
      </div>
    </main>
  );
}
