// src/components/BirthDetailsForm.tsx

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import styles from './BirthDetailsForm.module.css';
import GenderSelector from './GenderSelector';
import SmallSelect from './SmallSelect';
import TimeInput from './TimeInput';

import { IconCalendar, IconClock, IconGenderBigender, IconLanguage, IconMapPin } from '@tabler/icons-react';

const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'zh', label: 'Chinese' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'te', label: 'Telugu' },
  { value: 'pa', label: 'Punjabi' },
];

export interface BirthDetails {
  date_of_birth: string;
  time_of_birth: string;
  gender: string;
  birth_place: string;
  birth_lat: string;
  birth_lng: string;
  birth_timezone: string;
}

interface ProfileFormData {
  birthDetails: BirthDetails;
  languages: string[];
}

interface BirthDetailsFormProps {
  initialData: Partial<BirthDetails> | null;
  onSave: (formData: ProfileFormData) => void; 
  isSaving: boolean;
  isEditing: boolean;
}

export default function BirthDetailsForm({ initialData, onSave, isSaving, isEditing }: BirthDetailsFormProps) {
  const [dob, setDob] = useState('');
  const [dobDay, setDobDay] = useState<string>('');
  const [dobMonth, setDobMonth] = useState<string>('');
  const [dobYear, setDobYear] = useState<string>('');
  const [tob, setTob] = useState('');
  const [gender, setGender] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [language1, setLanguage1] = useState('en'); 
  const [language2, setLanguage2] = useState('');   

  // New State for Unknown Time
  const [unknownTime, setUnknownTime] = useState(false);

  // The "intent flag" to control the search
  const [allowSearch, setAllowSearch] = useState(true);

  const debouncedPlaceQuery = useDebounce(placeQuery, 500);

  // This useEffect handles populating the form with initial data
  useEffect(() => {
    if (initialData) {
      setDob(initialData.date_of_birth || '');
      setTob(initialData.time_of_birth || ''); 
      setGender(initialData.gender || '');
      setPlaceQuery(initialData.birth_place || '');

      // If we have full initial data for a place, pre-populate it and disable searching.
      if (initialData.birth_lat && initialData.birth_lng && initialData.birth_place) {
        setAllowSearch(false);
        setSelectedPlace({
          formatted: initialData.birth_place,
          lat: initialData.birth_lat,
          lon: initialData.birth_lng,
          // timezone: { name: initialData.birth_timezone }
        });
      }
    }
  }, [initialData]);

  // Logic: When unknownTime is checked, set time to 12:00 PM
  useEffect(() => {
    if (unknownTime) {
      setTob('12:00 PM');
    }
  }, [unknownTime]);

  // Initialize/select defaults for DOB selects
  useEffect(() => {
    if (dob && dob.includes('-')) {
      const [y, m, d] = dob.split('-');
      setDobYear(y);
      setDobMonth(m);
      setDobDay(d);
    } else {
      const today = new Date();
      const y = today.getFullYear().toString();
      const m = (today.getMonth() + 1).toString().padStart(2, '0');
      const d = today.getDate().toString().padStart(2, '0');
      setDobYear(y); setDobMonth(m); setDobDay(d);
      setDob(`${y}-${m}-${d}`);
    }
  }, []);

  // This useEffect now checks the allowSearch flag before fetching
  useEffect(() => {
    if (debouncedPlaceQuery.length > 2 && isEditing && allowSearch) {
      const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
      fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${debouncedPlaceQuery}&apiKey=${apiKey}`)
        .then(response => response.json())
        .then(data => setSuggestions(data.features || []))
        .catch(error => console.error('Error fetching suggestions:', error));
    } else {
      setSuggestions([]);
    }
  }, [debouncedPlaceQuery, isEditing, allowSearch]);

  // When a user selects a place, we disable further searching
  const handlePlaceSelect = (feature: any) => {
    const place = feature.properties;

    setAllowSearch(false);
    setPlaceQuery(place.formatted);
    setSelectedPlace(place);
    setSuggestions([]);
  };

  // When a user types in the input, we re-enable searching
  const handlePlaceQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaceQuery(e.target.value);

    setAllowSearch(true);
    setSelectedPlace(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!gender) {
      toast.error('Please select a gender.');
      return;
    }

    // Check if the date of birth is present
    if (!dob) {
      toast.error('Please select a date of birth.');
      return;
    }
    // Check if the time of birth is present
    if (!tob) {
      toast.error('Please enter a time of birth.');
      return;
    }

    if (isEditing && !selectedPlace) {
      toast.error('Please select a valid place from the suggestions.');
      return;
    }

    const selectedLanguages = [language1, language2].filter(lang => lang !== '');

    onSave({
      birthDetails: {
        date_of_birth: dob,
        time_of_birth: tob,
        gender: gender,
        birth_place: selectedPlace.formatted,
        birth_lat: selectedPlace.lat.toString(),
        birth_lng: selectedPlace.lon.toString(),
        birth_timezone: selectedPlace.timezone.name,
      },
      languages: selectedLanguages
    }); 
  };

  function daysInMonth(month: number, year: number): number {
    if (!month || !year) return 31;
    return new Date(year, month, 0).getDate();
  }

  function monthLabel(indexZeroBased: number): string {
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return names[indexZeroBased];
  }

  function convertTo24Hour(time12h: string): string {
    if (!time12h || !time12h.includes(' ')) return '00:00';
    const [time, period] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (period.toUpperCase() === 'PM') hours = (parseInt(hours, 10) + 12).toString();
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  function convertTo12Hour(time24h: string): string {
    if (!time24h || !time24h.includes(':')) return '12:00 AM';
    const [hours24, minutes] = time24h.split(':');
    const hour24 = parseInt(hours24, 10);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minutes} ${period}`;
  }

  return (
    <form id="birth-details-form" onSubmit={handleSubmit} className={styles.formContainer}>
      {/* Gender Section */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #F472B6 0%, #A855F7 100%)' }}>
            <IconGenderBigender size={20} />
          </div>
          <label>Select Your Gender</label>
        </div>
        <GenderSelector selectedValue={gender} onChange={setGender} disabled={!isEditing} />
      </div>

      {/* Date of Birth Section */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #FB923C 0%, #EF4444 100%)' }}>
            <IconCalendar size={20} />
          </div>
          <label>Date of Birth</label>
        </div>
        <div className={styles.dateRow}>
          <SmallSelect
            value={dobDay}
            onChange={(v) => { setDobDay(v); setDob(`${dobYear}-${dobMonth}-${v}`); }}
            options={Array.from({ length: daysInMonth(parseInt(dobMonth || '1', 10), parseInt(dobYear || '2000', 10)) }, (_, i) => {
              const val = (i + 1).toString().padStart(2, '0');
              return { value: val, label: String(i + 1) };
            })}
            disabled={!isEditing}
          />
          <SmallSelect
            value={dobMonth}
            onChange={(v) => {
              setDobMonth(v);
              const d = Math.min(parseInt(dobDay || '01', 10), daysInMonth(parseInt(v, 10), parseInt(dobYear || '2000', 10))).toString().padStart(2, '0');
              setDobDay(d);
              setDob(`${dobYear}-${v}-${d}`);
            }}
            options={Array.from({ length: 12 }, (_, i) => {
              const val = (i + 1).toString().padStart(2, '0');
              return { value: val, label: monthLabel(i) };
            })}
            disabled={!isEditing}
          />
          <SmallSelect
            value={dobYear}
            onChange={(v) => {
              setDobYear(v);
              const d = Math.min(parseInt(dobDay || '01', 10), daysInMonth(parseInt(dobMonth || '1', 10), parseInt(v, 10))).toString().padStart(2, '0');
              setDobDay(d);
              setDob(`${v}-${dobMonth}-${d}`);
            }}
            options={(() => {
              const current = new Date().getFullYear();
              const start = current - 100;
              const years: { value: string; label: string }[] = [];
              for (let y = current; y >= start; y--) years.push({ value: y.toString(), label: y.toString() });
              return years;
            })()}
            disabled={!isEditing}
          />
        </div>
      </div>

      {/* Time of Birth Section */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #22D3EE 0%, #3B82F6 100%)' }}>
            <IconClock size={20} />
          </div>
          <label>Time of Birth</label>
        </div>
        
        {/* Pass disabled if unknownTime is checked */}
        <div style={{ opacity: unknownTime ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <TimeInput
            value={convertTo24Hour(tob)}
            onChange={(time24: string) => setTob(convertTo12Hour(time24))}
            disabled={!isEditing || unknownTime}
            />
        </div>

        {/* Checkbox for Unknown Time */}
        <div className={styles.checkboxWrapper}>
           <label className={styles.customCheckbox}>
             <input 
               type="checkbox" 
               checked={unknownTime}
               onChange={(e) => setUnknownTime(e.target.checked)}
               disabled={!isEditing}
             />
             <span className={styles.checkmark}></span>
             <span className={styles.checkboxLabel}>I don't know my birth time</span>
           </label>
        </div>
        
      </div>

      {/* Place of Birth Section */}
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
            onChange={handlePlaceQueryChange}
            placeholder="Start typing your city..."
            required
            disabled={!isEditing}
            className={styles.styledInput}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className={styles.suggestionsList}>
              {suggestions.map(feature => (
                <li key={feature.properties.place_id} onClick={() => handlePlaceSelect(feature)} className={styles.suggestionItem}>
                  {feature.properties.formatted}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Language Section */}
      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.iconCircle} style={{ background: 'linear-gradient(90deg, #6366F1 0%, #EC4899 100%)' }}>
            <IconLanguage size={20} />
          </div>
          <label>Preferred Languages</label>
        </div>
        <div className={styles.languageRow}>
          <SmallSelect
            value={language1}
            onChange={(v) => {
              if (v === language2) setLanguage2(''); 
              setLanguage1(v);
            }}
            options={SUPPORTED_LANGUAGES}
            disabled={!isEditing}
          />
          <SmallSelect
            value={language2}
            onChange={(v) => setLanguage2(v)}
            options={[
                { value: '', label: 'None' }, 
                ...SUPPORTED_LANGUAGES.filter(lang => lang.value !== language1) 
            ]}
            disabled={!isEditing}
          />
        </div>
      </div>
    </form>
  );
}