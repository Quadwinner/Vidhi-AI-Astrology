import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './MobileProfileSelector.module.css';
import { EnrichedProfile } from './ProfileCard';
import { FiPlus, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';

// --- Helper Functions (no changes) ---
const formatDate = (dateString: string) => {
  if (!dateString || !dateString.includes('-')) return dateString;
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const formatTime = (timeString: string) => {
  if (!timeString) return '';
  return timeString.substring(0, 5);
};

interface MobileProfileSelectorProps {
  profiles: EnrichedProfile[];
  selectedProfileId: string | null;
  onProfileSelect: (profile: EnrichedProfile) => void;
  onAddProfileClick: (e: React.MouseEvent) => void;
}

export default function MobileProfileSelector({
  profiles,
  selectedProfileId,
  onProfileSelect,
  onAddProfileClick,
}: MobileProfileSelectorProps) {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSelect = (profile: EnrichedProfile) => {
    onProfileSelect(profile);
    setDropdownOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* --- NEW LOGIC --- */}
      {/* If there are no profiles, show a dedicated "Add Profile" link. */}
      {profiles.length === 0 ? (
        <Link 
          to="/profiles/new" 
          className={styles.addProfileLink} // This style should work well as a standalone bar
          onClick={onAddProfileClick}
        >
          <span className={styles.addProfileIconWrapper}>
            <FiPlus size={20} />
          </span>
          <span>Add Your First Profile</span>
        </Link>
      ) : (
        /* If profiles exist AND one is selected, show the original dropdown trigger. */
        selectedProfile && (
          <>
            <button 
              className={styles.triggerButton} 
              onClick={() => setDropdownOpen(!isDropdownOpen)}
            >
              <div className={styles.profileAvatar}>
                {selectedProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.profileInfoDesktop}>
                <span className={styles.profileName}>{selectedProfile.name}</span>
                <span className={styles.detailItem}><FiCalendar color="#38bdf8" /> {formatDate(selectedProfile.date_of_birth)}</span>
                <span className={styles.detailItem}><FiClock color="#fb923c" /> {formatTime(selectedProfile.time_of_birth)}</span>
                <span className={styles.detailItem}><FiMapPin color="#34d399" /> {selectedProfile.birth_place}</span>
              </div>
              <svg className={`${styles.chevron} ${isDropdownOpen ? styles.open : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {isDropdownOpen && (
              <div className={styles.dropdownPanel}>
                <Link 
                  to="/profiles/new" 
                  className={styles.addProfileLink} 
                  onClick={onAddProfileClick}
                >
                  <span className={styles.addProfileIconWrapper}>
                    <FiPlus size={20} />
                  </span>
                  <span>Add New Profile</span>
                </Link>
                <div className={styles.separator}></div>
                <div className={styles.profilesList}>
                  {profiles.map(profile => (
                    <button
                      key={profile.id}
                      className={`${styles.dropdownItem} ${selectedProfileId === profile.id ? styles.active : ''}`}
                      onClick={() => handleSelect(profile)}
                    >
                      <div className={styles.itemContent}>
                        <span className={styles.itemName}>{profile.name}</span>
                        <div className={styles.itemDetails}>
                          <span className={styles.detailItem}><FiCalendar color="#38bdf8" size={14} /> {formatDate(profile.date_of_birth)}</span>
                          <span className={styles.detailItem}><FiClock color="#fb923c" size={14} /> {formatTime(profile.time_of_birth)}</span>
                          <span className={`${styles.detailItem} ${styles.locationDetail}`}><FiMapPin color="#34d399" size={14} /> {profile.birth_place}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}