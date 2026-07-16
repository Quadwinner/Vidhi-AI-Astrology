import { IconCamera } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../supabaseClient';
import styles from './EditProfileSection.module.css';
import { EnrichedProfile } from './ProfileCard';

interface EditProfileSectionProps {
  profile: EnrichedProfile;
  currentUser: any;
  onBack: () => void;
  onUpdate: () => void;
}

export default function EditProfileSection({ profile, currentUser, onBack, onUpdate }: EditProfileSectionProps) {
  const [loading, setLoading] = useState(false);
  
  // Form Fields
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [tob, setTob] = useState('');
  
  // --- GEOAPIFY LOGIC ---
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [allowSearch, setAllowSearch] = useState(true);
  
  const debouncedPlaceQuery = useDebounce(placeQuery, 500);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setDob(profile.date_of_birth || '');
      setTob(profile.time_of_birth ? profile.time_of_birth.substring(0, 5) : '');
      setPlaceQuery(profile.birth_place || '');
    }
  }, [profile]);

  useEffect(() => {
    if (debouncedPlaceQuery.length > 2 && allowSearch) {
      const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
      
      fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${debouncedPlaceQuery}&apiKey=${apiKey}`)
        .then(response => response.json())
        .then(data => setSuggestions(data.features || []))
        .catch(error => console.error('Error fetching suggestions:', error));
    } else {
      setSuggestions([]);
    }
  }, [debouncedPlaceQuery, allowSearch]);

  const handlePlaceSelect = (feature: any) => {
    const place = feature.properties;
    setAllowSearch(false);
    setPlaceQuery(place.formatted);
    setSelectedPlace(place);
    setSuggestions([]);
  };

  const handlePlaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaceQuery(e.target.value);
    setAllowSearch(true);
    setSelectedPlace(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ name: name })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      const updates: any = {
        date_of_birth: dob,
        time_of_birth: tob,
        birth_place: placeQuery 
      };

      if (selectedPlace) {
        updates.birth_place = selectedPlace.formatted;
        updates.birth_lat = selectedPlace.lat.toString();
        updates.birth_lng = selectedPlace.lon.toString();
        updates.birth_timezone = selectedPlace.timezone?.name;
      }

      const { error: detailsError } = await supabase
        .from('user_birth_details')
        .update(updates)
        .eq('profile_id', profile.id);

      if (detailsError) throw detailsError;

      toast.success('Profile updated successfully!');
      onUpdate(); 
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return 'QP';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // --- EMAIL DISPLAY LOGIC FIXED HERE ---
  // If email exists AND it does NOT contain '.temp' (which indicates a generated phone-auth email), use it.
  // Otherwise, fallback to the placeholder.
  const displayEmail = (currentUser?.email && !currentUser.email.includes('.temp')) 
    ? currentUser.email 
    : 'abcd@email.com';

  const displayPhone = currentUser?.user_metadata?.phone || '+91 98765 43210';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        
        {/* Left Side: Avatar */}
        <div className={styles.avatarContainer}>
          <div className={styles.initialsAvatar}>
            {getInitials(name)}
            <button className={styles.cameraBtn}>
              <IconCamera size={18} />
            </button>
          </div>
        </div>

        {/* Right Side: Form + Button Wrapper */}
        <div className={styles.rightColumn}>
          
          <div className={styles.formGrid}>
            {/* Row 1 */}
            <div className={styles.inputGroup}>
              <label>Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className={styles.inputField}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Email</label>
              <input 
                type="text" 
                value={displayEmail} 
                readOnly 
                className={`${styles.inputField} ${styles.readOnly}`} 
              />
            </div>

            {/* Row 2 */}
            <div className={styles.inputGroup}>
              <label>Phone Number</label>
              <input 
                type="text" 
                value={displayPhone} 
                readOnly 
                className={`${styles.inputField} ${styles.readOnly}`} 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Date of Birth</label>
              <input 
                type="date" 
                value={dob} 
                onChange={(e) => setDob(e.target.value)}
                className={styles.inputField}
              />
            </div>

            {/* Row 3 */}
            <div className={styles.inputGroup}>
              <label>Time of Birth</label>
              <input 
                type="time" 
                value={tob} 
                onChange={(e) => setTob(e.target.value)}
                className={styles.inputField}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Birth Location</label>
              <div className={styles.locationWrapper}>
                <input 
                  type="text" 
                  value={placeQuery} 
                  onChange={handlePlaceChange}
                  className={styles.inputField}
                  placeholder="Search City..."
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <ul className={styles.suggestionsList}>
                    {suggestions.map((feature: any) => (
                      <li 
                        key={feature.properties.place_id} 
                        onClick={() => handlePlaceSelect(feature)}
                      >
                        {feature.properties.formatted}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Footer inside the column flow */}
          <div className={styles.footer}>
            <button 
              className={styles.saveButton} 
              onClick={handleSave} 
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>

        </div> {/* End rightColumn */}

      </div>
    </div>
  );
}