// src/components/KundliSection.tsx

// MODIFIED: Added useMemo to the React import
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import styles from './KundliSection.module.css';
import kundlilogo from '../assets/kundlilogo.svg';

import KundliCreationForm, { BirthDetails } from './KundliCreationForm';
import UpgradeForProfilesModal from './UpgradeForProfilesModal';
import ProfileCard, { EnrichedProfile } from './ProfileCard';
import { getTimezoneOffset } from 'date-fns-tz';
import AuthModal from './AuthModal'; // NEW: Import the AuthModal component

const PENDING_KUNDLI_DETAILS_KEY = 'pendingKundliDetails';

// --- Helper function (No changes) ---
const convertTo24Hour = (time12h: string): string => {
  if (!time12h || !time12h.includes(' ')) return "00:00";
  const [time, period] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (period.toUpperCase() === 'PM') hours = (parseInt(hours, 10) + 12).toString();
  return `${hours.padStart(2, '0')}:${minutes}`;
};


export default function KundliSection() {
  // MODIFIED: Destructure all the necessary auth functions
  const { 
    user, 
    userProfiles, 
    planTier, 
    signInWithFirebaseGoogle, // Use the firebase version
    requestPhoneOtp,
    verifyPhoneOtp,
    requestFirebasePhoneOtp,
    verifyFirebasePhoneOtp,
    verifyMsg91Otp,
    refreshUserStatus, 
    checkingStatus 
  } = useAuth();
  const navigate = useNavigate();

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'saved'>('new');
  const [enrichedProfiles, setEnrichedProfiles] = useState<EnrichedProfile[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); // NEW: State for our auth modal

  // NEW: Memoize phone auth handlers to pass to the modal
  const phoneAuthHandlers = useMemo(() => ({
    requestOtp: requestPhoneOtp,
    verifyOtp: verifyPhoneOtp,
  }), [requestPhoneOtp, verifyPhoneOtp]);

  const firebasePhoneAuthHandlers = useMemo(() => ({
    requestOtp: requestFirebasePhoneOtp,
    verifyOtp: verifyFirebasePhoneOtp,
  }), [requestFirebasePhoneOtp, verifyFirebasePhoneOtp]);

  const msg91AuthHandlers = useMemo(() => ({
    verifyOtp: verifyMsg91Otp,
  }), [verifyMsg91Otp]);


  // --- useEffect for fetching birth details (No changes) ---
  useEffect(() => {
    const fetchBirthDetails = async () => {
      if (!userProfiles || userProfiles.length === 0) {
        setLoadingDetails(false);
        return;
      }

      setLoadingDetails(true);
      const profileIds = userProfiles.map(p => p.id);

      const { data: birthDetails, error } = await supabase
        .from('user_birth_details')
        .select('*')
        .in('profile_id', profileIds);

      if (error) {
        console.error("Error fetching birth details:", error);
        setLoadingDetails(false);
        return;
      }

      const enriched = userProfiles.map(profile => {
        const details = birthDetails.find(d => d.profile_id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          gender: details?.gender || 'N/A',
          date_of_birth: details?.date_of_birth || '',
          time_of_birth: details?.time_of_birth || '',
          birth_place: details?.birth_place || 'N/A',
        };
      });

      setEnrichedProfiles(enriched as EnrichedProfile[]);
      setLoadingDetails(false);
    };

    if (!checkingStatus) {
      fetchBirthDetails();
    }
  }, [userProfiles, checkingStatus]);


  // MODIFIED: The core logic change is in this function
  const handleFormSubmit = async (details: BirthDetails) => {
    // If there is no user...
    if (!user) {
      // Keep saving the details to session storage
      sessionStorage.setItem(PENDING_KUNDLI_DETAILS_KEY, JSON.stringify(details));
      // ...but instead of signing in, just open our modal
      setIsAuthModalOpen(true);
      return;
    }

    // --- The rest of the function for logged-in users remains the same ---
    if (userProfiles && userProfiles.length > 0 && planTier !== 'yearly') {
      setIsUpgradeModalOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const ianaTimezone = details.birth_timezone;
      const time24h = convertTo24Hour(details.time_of_birth);
      const dateString = `${details.date_of_birth}T${time24h}`;
      const offsetInMilliseconds = getTimezoneOffset(ianaTimezone, new Date(dateString));
      const timezoneOffset = offsetInMilliseconds / 3600000;

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert({ name: details.name, user_id: user.id })
        .select()
        .single();

      if (profileError) throw profileError;

      const { error: birthDetailsError } = await supabase
        .from('user_birth_details')
        .insert({
          profile_id: profileData.id,
          date_of_birth: details.date_of_birth,
          time_of_birth: details.time_of_birth,
          gender: details.gender,
          birth_place: details.birth_place,
          birth_lat: details.birth_lat,
          birth_lng: details.birth_lng,
          birth_timezone: details.birth_timezone,
          timezone_offset: timezoneOffset,
        });

      if (birthDetailsError) throw birthDetailsError;

      await refreshUserStatus();
      navigate('/reports');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('Failed to save your Kundli details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (checkingStatus) return null;

  return (
    <>
      <section className={`aura-section aura-kundli ${styles.kundliSection}`}>
        <div className="aura-container">
          <div className="aura-section-head">
            <span className="aura-eyebrow">
              <img src={kundlilogo} alt="" style={{ width: 18, height: 18 }} />
              Free birth chart
            </span>
            <h2 className="aura-h2">The blueprint of your soul</h2>
            <p className="aura-lead">
              Your Kundli is a cosmic map of the sky at the exact moment of your arrival —
              shaping your personality, career, and karmic path. Generate yours free.
            </p>
          </div>

        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <div
              className={activeTab === 'new' ? styles.activeTab : styles.deactiveTab}
              onClick={() => setActiveTab('new')}
            >
              New Kundli
            </div>
            <div
              className={activeTab === 'saved' ? styles.activeTab : styles.deactiveTab}
              onClick={() => setActiveTab('saved')}
            >
              Saved Kundli
            </div>
          </div>

          <div className={styles.formBody}>
            {activeTab === 'new' ? (
              <>
                <KundliCreationForm
                  onSave={handleFormSubmit}
                  isSaving={isSaving}
                  isEditing={!isSaving}
                />
                <div className={styles.descriptionInside}>
                  <p>
                    Each House In The Free Online Kundali Reveals Different Areas Of Life Such As The
                    Occupational, Affiliative, Physical, And Spiritual. The Sign Position Of The Planet And
                    The Aspects Between Them Make Up The Foundation Of The Interpretation Of The Astrological Houses.
                  </p>
                </div>
              </>
            ) : (
              <>
                {loadingDetails ? (
                  <p>Loading saved Kundli...</p>
                ) : enrichedProfiles.length > 0 ? (
                  <div className={styles.savedGrid}>
                    {enrichedProfiles.map((profile, index) => (
                      <ProfileCard
                        key={profile.id}
                        profile={profile}
                        index={index}
                        isCurrent={false}
                        onClick={(p) => navigate(`/reports`)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className={styles.noProfiles}>No saved Kundli found. Create a new one!</p>
                )}
              </>
            )}
          </div>
        </div>
        </div>
      </section>

      <UpgradeForProfilesModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {/* NEW: Render the AuthModal and pass it the correct, full-featured props */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={signInWithFirebaseGoogle}
        phoneAuth={phoneAuthHandlers}
        firebasePhoneAuth={firebasePhoneAuthHandlers}
        msg91Auth={msg91AuthHandlers}
      />
    </>
  );
}