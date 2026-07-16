  // src/pages/CreateProfilePage.tsx

  import { getTimezoneOffset } from 'date-fns-tz';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BirthDetailsForm, { BirthDetails } from '../components/BirthDetailsForm';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import styles from './CreateProfilePage.module.css';

  // --- 1. IMPORT TOAST ---
  import toast from 'react-hot-toast';

  import { IconUser, IconCircleCheck, IconArrowLeft, IconSparkles } from '@tabler/icons-react';

  const ZODIAC = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];

  interface ProfileFormData {
    birthDetails: BirthDetails;
    languages: string[];
  }

  export default function CreateProfilePage() {
    const { user, refreshUserStatus } = useAuth();
    const navigate = useNavigate();
    // We can still keep the 'saving' state to disable the button, as toast is separate
    const [saving, setSaving] = useState(false);
    const [profileName, setProfileName] = useState('');

    useEffect(() => {
      if (!user) {
        setTimeout(() => navigate('/'), 1000);
      }
    }, [user, navigate]);

    const handleCreateProfile = async (formData: ProfileFormData) => {
      const { birthDetails, languages } = formData;
      if (!user) {
        toast.error('You must be logged in to create a profile.');
        return;
      }
      if (!profileName.trim()) {
        toast.error('Please provide a name for the profile.');
        return;
      }

      trackEvent('Profile Creation Submitted', {
        source: 'Create Profile Page',
        profile_name_length: profileName.trim().length,
      });

      setSaving(true);

      let preferred_language = 'en'; // Default to English
      if (languages.length === 1) {
        preferred_language = languages[0];
      } else if (languages.length === 2) {
        const englishIndex = languages.indexOf('en');
        if (englishIndex !== -1) {
          // If 'en' is one of the two, use the other one.
          preferred_language = englishIndex === 0 ? languages[1] : languages[0];
        } else {
          // If two non-english languages are selected, use the first one.
          preferred_language = languages[0];
        }
      }

      const saveProfile = async () => {
        // --- STEP 1: Calculate the correct timezone offset using the correct function ---
        const ianaTimezone = birthDetails.birth_timezone;

        const convertTo24Hour = (time12h: string): string => {
          if (!time12h || !time12h.includes(' ')) return '00:00';
          const [time, period] = time12h.split(' ');
          let [hours, minutes] = time.split(':');
          if (hours === '12') hours = '00';
          if (period.toUpperCase() === 'PM') hours = (parseInt(hours, 10) + 12).toString();
          return `${hours.padStart(2, '0')}:${minutes}`;
        };

        const time24h = convertTo24Hour(birthDetails.time_of_birth);
        const dateString = `${birthDetails.date_of_birth}T${time24h}`;

        // getTimezoneOffset gives us the offset in milliseconds.
        // It correctly handles historical dates and Daylight Saving Time.
        const offsetInMilliseconds = getTimezoneOffset(ianaTimezone, new Date(dateString));

        // Convert milliseconds to hours (1 hour = 3,600,000 ms)
        const timezoneOffset = offsetInMilliseconds / 3600000;

        // --- The rest of the function remains the same ---

        // Step 2: Insert the main profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .insert({ user_id: user.id, name: profileName.trim(), preferred_language: preferred_language })
          .select('id')
          .single();

        if (profileError) throw profileError;

        const newProfileId = profileData.id;

        // Step 3: Save the complete details with the calculated offset
        const completeBirthDetails = {
          profile_id: newProfileId,
          date_of_birth: birthDetails.date_of_birth,
          time_of_birth: birthDetails.time_of_birth,
          gender: birthDetails.gender,
          birth_place: birthDetails.birth_place,
          birth_lat: birthDetails.birth_lat,
          birth_lng: birthDetails.birth_lng,
          birth_timezone: birthDetails.birth_timezone,
          timezone_offset: timezoneOffset, // The new, accurate value
        };

        const { error: birthDetailsError } = await supabase
          .from('user_birth_details')
          .insert(completeBirthDetails);

        if (birthDetailsError) throw birthDetailsError;

        return newProfileId;
      };

      const createAndRefreshProfile = async () => {
        // First, await the result of saving the profile to the database.
        const newProfileId = await saveProfile();

        // IMPORTANT: If the save is successful, immediately refresh the user status.
        // This will update the AuthContext with the new profile list.
        await refreshUserStatus();

        // Finally, return the new profile ID so the success handler can use it.
        return newProfileId;
      };

      toast.promise(
        createAndRefreshProfile(),
        {
          loading: 'Saving your cosmic profile...',
          success: (newProfileId) => {
            // Now, when this code runs, the AuthContext is already fresh.
            navigate('/chat', {
              state: {
                fromProceed: true,
                newlyCreatedProfileId: newProfileId
              }
            });
            return <b>Profile created successfully!</b>;
          },
          error: (err) => {
            console.error(err);
            // This will now also catch errors from the RLS policy!
            if (err.message.includes('violates row-level security policy')) {
              return <b>You have reached your profile limit.</b>;
            }
            return <b>Could not save profile: {err.message}</b>;
          },
        }
      ).finally(() => {
        setSaving(false);
      });
    };


    if (!user) {
      return <div className={styles.pageContainer}><h1>Redirecting...</h1></div>;
    }

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

    return (
      <div className={styles.page}>
        <div className={styles.stars} aria-hidden="true" />
        <div className={styles.grid}>

          {/* Brand panel */}
          <aside className={styles.brand}>
            <button className={styles.back} onClick={() => navigate(-1)}>
              <IconArrowLeft size={16} /><span>Back</span>
            </button>

            <div className={styles.wheelWrap} aria-hidden="true">
              <div className={styles.wheel}>
                {ZODIAC.map((z, i) => (
                  <span key={i} style={{ transform: `rotate(${i * 30}deg) translateY(-140px)` }}>{z}</span>
                ))}
              </div>
              <div className={styles.wheelCore}><IconSparkles size={30} /></div>
            </div>

            <h1 className={styles.brandTitle}>Create your<br />cosmic profile</h1>
            <p className={styles.brandSub}>Hey {userName}, add your birth details and we'll map your stars.</p>

            <ul className={styles.benefits}>
              <li><IconCircleCheck size={20} /><span>Personalized birth chart (Kundli)</span></li>
              <li><IconCircleCheck size={20} /><span>Dasha timeline & life predictions</span></li>
              <li><IconCircleCheck size={20} /><span>AI chat & voice guidance</span></li>
            </ul>

            <p className={styles.privacy}>Your details stay private — used only for your readings.</p>
          </aside>

          {/* Form panel */}
          <section className={styles.formPanel}>
            <div className={styles.formCard}>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>
                  <span className={styles.fieldIcon}><IconUser size={18} /></span>
                  <label htmlFor="profileName">Profile Name</label>
                </div>
                <input
                  type="text"
                  id="profileName"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., My Profile, Jane Doe..."
                  required
                  className={styles.styledInput}
                />
              </div>

              <BirthDetailsForm
                initialData={{}}
                onSave={handleCreateProfile}
                isSaving={saving}
                isEditing={true}
              />

              <p className={styles.warningMessage}>
                Birth details can't be edited after creation — please review carefully.
              </p>

              <button type="submit" form="birth-details-form" disabled={saving} className={styles.submitButton}>
                {saving ? 'Creating your profile…' : 'Proceed'}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }