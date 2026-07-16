import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import styles from './InlineCompatibilityForm.module.css';
import { IconMapPin, IconLoader, IconX, IconCheck, IconHeartHandshake, IconLock, IconCalendar, IconLockOpen } from '@tabler/icons-react';
import toast from 'react-hot-toast';

// Simple Gender Select
const CompactGenderSelect = ({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled?: boolean }) => {
  if (disabled) return <input className={styles.input} disabled value={value} readOnly />;
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className={styles.input}
      disabled={disabled}
    >
      <option value="" disabled>Select</option>
      <option value="Male">Male</option>
      <option value="Female">Female</option>
      <option value="Other">Other</option>
    </select>
  );
};

// --- LOCALIZATION DICTIONARY ---
const TEXT_CONTENT: any = {
  en: {
    titles: {
      reconciliation: 'Will you reconnect?',
      marriage: 'Are they the one?',
      cheating: 'Is something off?',
      default: 'Add Partner Details'
    },
    subtitles: {
      reconciliation: 'Add their details to see if reunion is possible.',
      marriage: 'Your chart looks promising. Let’s match it with theirs.',
      cheating: 'Stop guessing. Let the stars show the truth.',
      default: 'Unlock all relationship answers for both of you.'
    },
    cta: {
      reconciliation: 'Save Profile',
      marriage: 'Save Profile',
      cheating: 'Save Profile',
      default: 'Save Profile',
      unlock: 'Save Profile'
    },
    saved: 'Saved',
    unlockPrompt: 'Result locked. Unlock to view.'
  },

  hi: {
    titles: {
      reconciliation: 'Kya reconnect hoga?',
      marriage: 'Kya ye “the one” hai?',
      cheating: 'Kuch galat lag raha?',
      default: 'Result complete karein'
    },
    subtitles: {
      reconciliation: 'Unka detail add karein aur reunion dekhein.',
      marriage: 'Aapka chart strong hai. Ab unka match dekhein.',
      cheating: 'Guess mat karein. Stars ko bolne dein.',
      default: 'Taaki aap dono ke saare relationship answers mil sakein.'
    },
    cta: {
      reconciliation: 'Save Profile',
      marriage: 'Save Profile',
      cheating: 'Save Profile',
      default: 'Save Profile',
      unlock: 'Save Profile'
    },
    saved: 'Saved',
    unlockPrompt: 'Result locked hai. Unlock karein.'
  }
};

interface InlineCompatibilityFormProps {
  initialName?: string | null;
  initialDob?: string | null;
  initialTob?: string | null;
  initialGender?: string | null;
  // New Location Props
  initialPlace?: string | null;
  initialLat?: string | null;
  initialLng?: string | null;
  initialTimezone?: string | null;
  
  subCategory?: string;
  isLocked?: boolean;
  needsPayment?: boolean;
  language?: string;
  onClose?: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export default function InlineCompatibilityForm({ 
  initialName, 
  initialDob, 
  initialTob, 
  initialGender,
  initialPlace,
  initialLat,
  initialLng,
  initialTimezone,
  subCategory,
  isLocked = false,
  needsPayment = false,
  language = 'en',
  onClose,
  onSubmit, 
  isLoading 
}: InlineCompatibilityFormProps) {

  const [name, setName] = useState(initialName || '');
  const [dob, setDob] = useState(initialDob || '');
  const [tob, setTob] = useState(initialTob || '12:00');
  const [gender, setGender] = useState(initialGender || '');
  
  // Location State
  const [placeQuery, setPlaceQuery] = useState(initialPlace || '');
  
  // Initialize selectedPlace from props if available (Fixes 400 error on retry)
  const [selectedPlace, setSelectedPlace] = useState<any>(
    initialLat ? { 
      formatted: initialPlace, 
      lat: parseFloat(initialLat), 
      lon: parseFloat(initialLng || '0'), 
      timezone: { name: initialTimezone } 
    } : null
  );

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedPlaceQuery = useDebounce(placeQuery, 500);

  const placeInputRef = useRef<HTMLInputElement>(null);

  // Focus Place input on mount if other data is present and not locked
  useEffect(() => {
    if (!isLocked && initialName && initialDob && !selectedPlace && !initialPlace) {
      setTimeout(() => placeInputRef.current?.focus(), 600);
    }
  }, [initialName, initialDob, isLocked, selectedPlace, initialPlace]);

  // Location API
  useEffect(() => {
    // FIX: Added !selectedPlace check. 
    // This prevents the search from running immediately after you click a suggestion.
    if (debouncedPlaceQuery.length > 2 && !isLocked && !selectedPlace) {
      const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
      fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${debouncedPlaceQuery}&apiKey=${apiKey}`)
        .then(res => res.json())
        .then(data => {
            setSuggestions(data.features || []);
            setShowSuggestions(true);
        })
        .catch(err => console.error(err));
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedPlaceQuery, selectedPlace, isLocked]);

  const handlePlaceSelect = (feature: any) => {
    // 1. Set the display text
    setPlaceQuery(feature.properties.formatted);
    // 2. Set the actual data object
    setSelectedPlace(feature.properties);
    // 3. Hide suggestions immediately
    setShowSuggestions(false);
    // 4. Clear suggestions array to be safe
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked && !needsPayment) return;

    if (!isLocked) {
        if (!name.trim()) { toast.error("Partner name required"); return; }
        if (!dob) { toast.error("Birth Date required"); return; }
        // Allow submission if we have a selected object OR just text (fallback, though less ideal)
        if (!selectedPlace && !placeQuery) { toast.error("Please select a city from the list"); return; }
        if (!gender) { toast.error("Gender required"); return; }
    }

    const payload = {
        partner_name: name,
        partner_gender: gender,
        date_of_birth: dob,
        time_of_birth: tob,
        birth_place: selectedPlace?.formatted || placeQuery,
        birth_lat: selectedPlace?.lat?.toString() || initialLat || '0',
        birth_lng: selectedPlace?.lon?.toString() || initialLng || '0',
        birth_timezone: selectedPlace?.timezone?.name || initialTimezone || 'Asia/Kolkata'
    };
    
    onSubmit(payload);
  };

  // --- DYNAMIC TEXT LOGIC ---
  const getDynamicText = () => {
    const langKey = (language === 'hi' || language === 'en') ? language : 'en';
    const text = TEXT_CONTENT[langKey];
    const sub = subCategory || '';
    
    if (sub.includes('reconciliation')) {
        return { 
            title: text.titles.reconciliation, 
            subtitle: text.subtitles.reconciliation,
            btn: text.cta.reconciliation
        };
    }
    if (sub.includes('marriage')) {
        return { 
            title: text.titles.marriage, 
            subtitle: text.subtitles.marriage,
            btn: text.cta.marriage
        };
    }
    if (sub.includes('cheating') || sub.includes('third_party')) {
        return { 
            title: text.titles.cheating, 
            subtitle: text.subtitles.cheating,
            btn: text.cta.cheating
        };
    }
    return { 
        title: text.titles.default, 
        subtitle: text.subtitles.default,
        btn: text.cta.default
    };
  };

  const { title, subtitle, btn } = getDynamicText();
  const langKey = (language === 'hi' || language === 'en') ? language : 'en';

  // --- LOCKED STATE ---
  // --- CHANGED: LOCKED STATE RENDERING ---
  // If it is locked/saved, we just show the summary. No "Unlock" button.
  if (isLocked) {
    return (
      <div className={styles.bubbleContainer} style={{ padding: '8px 4px' }}>
        <div className={styles.header} style={{ borderBottom: 'none', marginBottom: '8px' }}>
            <div className={styles.titleGroup}>
                <h4 className={styles.mainTitle} style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <IconCheck size={18} /> 
                   Profile Saved
                </h4>
                <span className={styles.subTitle}>
                   Compatibility data is ready for analysis.
                </span>
            </div>
        </div>
        
        <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '8px', 
            padding: '12px', 
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px' 
        }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                {name} <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 400 }}>({gender})</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconCalendar size={14} color="#A855F7" /> {dob} at {tob}
            </div>
            {(placeQuery || initialPlace) && (
                <div style={{ fontSize: '0.85rem', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconMapPin size={14} color="#A855F7" /> {placeQuery || initialPlace}
                </div>
            )}
        </div>
      </div>
    );
  }

  // --- ACTIVE FORM STATE ---
  return (
    <div className={styles.bubbleContainer}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h4 className={styles.mainTitle}>{title}</h4>
          <span className={styles.subTitle}>{subtitle}</span>
        </div>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} title="Close">
            <IconX size={16} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.formGrid}>
        <div className={styles.row}>
          <div className={styles.col} style={{flex: 2}}>
            <label className={styles.label}>Name</label>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Partner Name" />
          </div>
          <div className={styles.col} style={{flex: 1}}>
             <label className={styles.label}>Gender</label>
             <CompactGenderSelect value={gender} onChange={setGender} />
          </div>
        </div>

        <div className={styles.row}>
           <div className={styles.col}>
             <label className={styles.label}>Birth Date</label>
             <input type="date" className={styles.input} value={dob} onChange={e => setDob(e.target.value)} />
           </div>
           <div className={styles.col}>
             <label className={styles.label}>Birth Time</label>
             <input type="time" className={styles.input} value={tob} onChange={e => setTob(e.target.value)} />
           </div>
        </div>

        <div className={styles.col}>
            <label className={styles.label}>Place of Birth</label>
            <div style={{position: 'relative'}}>
                <input 
                    ref={placeInputRef}
                    type="text"
                    className={styles.input}
                    value={placeQuery}
                    onChange={(e) => { 
                        setPlaceQuery(e.target.value); 
                        setSelectedPlace(null); // Reset selection on typing
                    }}
                    placeholder="Search City..."
                    autoComplete="off"
                />
                <div style={{ position: 'absolute', right: 10, top: 10, color: 'white', pointerEvents: 'none' }}>
                    <IconMapPin size={16} />
                </div>
            </div>
            
            {showSuggestions && suggestions.length > 0 && (
                <ul className={styles.suggestionsList}>
                    {suggestions.map((f: any) => (
                        <li key={f.properties.place_id} onClick={() => handlePlaceSelect(f)} className={styles.suggestionItem}>
                            {f.properties.formatted}
                        </li>
                    ))}
                </ul>
            )}
        </div>

        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isLoading ? <IconLoader className="spin" size={18} /> : <IconHeartHandshake size={18} />}
          {isLoading ? 'Saving Details...' : 'Save Profile'}
      </button>
      </form>
    </div>
  );
}