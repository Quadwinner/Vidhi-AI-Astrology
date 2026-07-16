import {
  IconCalendar,
  IconClock,
  IconGenderFemale,
  IconGenderMale,
  IconGenderTransgender,
  IconMapPin,
  IconPencil // <--- Imported Icon
  ,
  IconUser
} from '@tabler/icons-react';
import styles from './ProfileCard.module.css';

export interface EnrichedProfile {
  id: string;
  name: string;
  preferred_language: string | null;
  gender: string;
  date_of_birth: string;
  time_of_birth: string;
  birth_place: string;
}

interface ProfileCardProps {
  profile: EnrichedProfile;
  index: number;
  isCurrent?: boolean;
  onClick: (profile: EnrichedProfile) => void;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (timeString: string) => {
    if (!timeString || !timeString.includes(':')) return 'N/A';
    const [h, m] = timeString.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    let hour = h % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

const getGenderIcon = (gender: string) => {
    if (gender === 'Male') return <IconGenderMale size={14} className={styles.maleIcon} />;
    if (gender === 'Female') return <IconGenderFemale size={14} className={styles.femaleIcon} />;
    return <IconGenderTransgender size={14} className={styles.otherIcon} />;
}

export default function ProfileCard({ profile, index, isCurrent = false, onClick }: ProfileCardProps) {
  return (
    <div 
      className={`${styles.profileCard} ${isCurrent ? styles.currentProfile : ''}`} 
      onClick={() => onClick(profile)}
    >
      {/* --- NEW EDIT BUTTON --- */}
      <button 
        className={styles.editButton}
        onClick={(e) => {
          e.stopPropagation(); // Prevents double-firing if the card also has a click event
          onClick(profile);
        }}
        aria-label="Edit Profile"
      >
        <IconPencil size={18} />
      </button>

      <div className={styles.cardHeader}>
        <div className={styles.avatar}>
            <IconUser size={24} className={styles.avatarIcon} />
            <span className={styles.avatarNumber}>{index + 1}</span>
        </div>
        <div className={styles.nameContainer}>
          <span className={styles.name}>{profile.name}</span>
          {isCurrent && <span className={styles.tag}>Current Profile</span>}
        </div>
      </div>
      <div className={styles.cardDetails}>
        <div className={styles.detailItem}>
            {getGenderIcon(profile.gender)}
            <span className={styles.detailText}>{profile.gender}</span>
        </div>
        <div className={styles.detailItem}>
            <IconCalendar size={14} className={styles.dobIcon} />
            <span className={styles.detailText}>{formatDate(profile.date_of_birth)}</span>
        </div>
        <div className={styles.detailItem}>
            <IconClock size={14} className={styles.tobIcon} />
            <span className={styles.detailText}>{formatTime(profile.time_of_birth)}</span>
        </div>
        <div className={styles.detailItem}>
            <IconMapPin size={14} className={styles.pobIcon} />
            <span className={styles.detailText}>{profile.birth_place.split(',')[0]}</span>
        </div>
      </div>
    </div>
  );
}