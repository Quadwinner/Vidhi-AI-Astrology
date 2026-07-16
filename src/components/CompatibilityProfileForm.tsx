// src/components/CompatibilityProfileForm.tsx

import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import GenderSelector from './GenderSelector'; // Reusing your existing component
import TimeInput from './TimeInput'; // Reusing your existing component
import SmallSelect from './SmallSelect'; // Reusing your existing component
import styles from './BirthDetailsForm.module.css'; // Reusing existing styles to keep look consistent
import toast from 'react-hot-toast';
import { IconGenderBigender, IconCalendar, IconClock, IconMapPin, IconUser } from '@tabler/icons-react';

interface CompatibilityProfileFormProps {
  initialName?: string;
  onSave: (data: any) => void;
  isSaving: boolean;
}

export default function CompatibilityProfileForm({ initialName, onSave, isSaving }: CompatibilityProfileFormProps) {
  // 1. Name State (New)
  const [name, setName] = useState(initialName || '');
  
  // 2. Standard Birth Details State
  const [dob, setDob] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [tob, setTob] = useState('');
  const [gender, setGender] = useState('');
  
  // 3. Location Search State
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [allowSearch, setAllowSearch] = useState(true);
  const debouncedPlaceQuery = useDebounce(placeQuery, 500);

  // --- Initialize Date Defaults ---
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear().toString();
    const m = (today.getMonth() + 1).toString().padStart(2, '0');
    const d = today.getDate().toString().padStart(2, '0');
    if(!dobYear) { setDobYear(y); setDobMonth(m); setDobDay(d); setDob(`${y}-${m}-${d}`); }
  }, []);

  // --- Location Autocomplete Logic ---
  useEffect(() => {
    if (debouncedPlaceQuery.length > 2 && allowSearch) {
      const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
      fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${debouncedPlaceQuery}&apiKey=${apiKey}`)
        .then(res => res.json())
        .then(data => setSuggestions(data.features || []))
        .catch(err => console.error(err));
    } else {
      setSuggestions([]);
    }
  }, [debouncedPlaceQuery, allowSearch]);

  const handlePlaceSelect = (feature: any) => {
    setAllowSearch(false);
    setPlaceQuery(feature.properties.formatted);
    setSelectedPlace(feature.properties);
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) { toast.error("Please enter the partner's name."); return; }
    if (!gender) { toast.error("Please select a gender."); return; }
    if (!tob) { toast.error("Please enter a time of birth."); return; }
    if (!selectedPlace) { toast.error("Please select a valid place from the suggestions."); return; }

    const payload = {
        partner_name: name,
        partner_gender: gender,
        date_of_birth: dob,
        time_of_birth: tob,
        birth_place: selectedPlace.formatted,
        birth_lat: selectedPlace.lat.toString(),
        birth_lng: selectedPlace.lon.toString(),
        birth_timezone: selectedPlace.timezone.name
    };
    
    onSave(payload);
  };

  // --- Helpers ---
  function daysInMonth(m: number, y: number) { return new Date(y, m, 0).getDate(); }
  function convertTo24Hour(time12h: string): string {
    if (!time12h) return '00:00';
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
    return `${hours}:${minutes}`;
  }
  function convertTo12Hour(time24h: string): string {
    if (!time24h) return '';
    const [h, m] = time24h.split(':');
    const hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const adjustedHours = ((hours + 11) % 12 + 1);
    return `${adjustedHours}:${m} ${suffix}`;
  }

  return (
    <form id="compatibility-form" onSubmit={handleSubmit} className={styles.formContainer}>
      
      {/* 1. Name Input */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: '#6366F1' }}>
            <IconUser size={20} />
          </div>
          <label>Partner's Name</label>
        </div>
        <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Name"
            className={styles.styledInput}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        />
      </div>

      {/* 2. Gender */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #F472B6 0%, #A855F7 100%)' }}>
            <IconGenderBigender size={20} />
          </div>
          <label>Gender</label>
        </div>
        <GenderSelector selectedValue={gender} onChange={setGender} />
      </div>

      {/* 3. Date of Birth */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #FB923C 0%, #EF4444 100%)' }}>
            <IconCalendar size={20} />
          </div>
          <label>Date of Birth</label>
        </div>
        <div className={styles.dateRow}>
          <SmallSelect value={dobDay} onChange={(v) => { setDobDay(v); setDob(`${dobYear}-${dobMonth}-${v}`); }} options={Array.from({ length: 31 }, (_, i) => ({ value: (i+1).toString().padStart(2,'0'), label: (i+1).toString() }))} />
          <SmallSelect value={dobMonth} onChange={(v) => { setDobMonth(v); setDob(`${dobYear}-${v}-${dobDay}`); }} options={Array.from({ length: 12 }, (_, i) => ({ value: (i+1).toString().padStart(2,'0'), label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i] }))} />
          <SmallSelect value={dobYear} onChange={(v) => { setDobYear(v); setDob(`${v}-${dobMonth}-${dobDay}`); }} options={Array.from({ length: 100 }, (_, i) => { const y = new Date().getFullYear() - i; return { value: y.toString(), label: y.toString() }; })} />
        </div>
      </div>

      {/* 4. Time of Birth */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #22D3EE 0%, #3B82F6 100%)' }}>
            <IconClock size={20} />
          </div>
          <label>Time of Birth</label>
        </div>
        <TimeInput value={convertTo24Hour(tob)} onChange={(v) => setTob(convertTo12Hour(v))} />
      </div>

      {/* 5. Place of Birth */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #4ADE80 0%, #16A34A 100%)' }}>
            <IconMapPin size={20} />
          </div>
          <label>Place of Birth</label>
        </div>
        <div className={styles.autocompleteWrapper}>
          <input
            type="text"
            value={placeQuery}
            onChange={(e) => { setPlaceQuery(e.target.value); setAllowSearch(true); }}
            placeholder="Search city..."
            className={styles.styledInput}
          />
          {suggestions.length > 0 && (
            <ul className={styles.suggestionsList}>
              {suggestions.map(f => (
                <li key={f.properties.place_id} onClick={() => handlePlaceSelect(f)} className={styles.suggestionItem}>
                  {f.properties.formatted}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </form>
  );
}