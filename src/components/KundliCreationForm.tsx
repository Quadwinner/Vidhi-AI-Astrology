import React, { useEffect, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import styles from './KundliCreationForm.module.css';

export interface BirthDetails {
  name: string;
  date_of_birth: string;
  time_of_birth: string;
  gender: string;
  birth_place: string;
  birth_lat: string;
  birth_lng: string;
  birth_timezone: string;
}

interface KundliCreationFormProps {
  onSave: (details: BirthDetails) => void;
  isSaving: boolean;
  isEditing: boolean;
}

export default function KundliCreationForm({ onSave, isSaving, isEditing }: KundliCreationFormProps) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [tob, setTob] = useState('');
  const [gender, setGender] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [error, setError] = useState("");

  // --- NEW STATE: Unknown Time ---
  const [unknownTime, setUnknownTime] = useState(false);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  const [allowSearch, setAllowSearch] = useState(true);
  const debouncedPlaceQuery = useDebounce(placeQuery, 500);

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

  const handlePlaceSelect = (feature: any) => {
    const place = feature.properties;
    setAllowSearch(false);
    setPlaceQuery(place.formatted);
    setSelectedPlace(place);
    setSuggestions([]);
  };

  const handlePlaceQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaceQuery(e.target.value);
    setAllowSearch(true);
    setSelectedPlace(null);
  };

  // --- Handle Checkbox Toggle ---
  const handleUnknownTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUnknownTime(e.target.checked);
    if (e.target.checked) {
        // Optional: Visually set TOB to noon when checked or clear it
        setTob("12:00 PM"); 
    } else {
        setTob(""); // Reset so user has to select again
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlace?.formatted) {
      setError('Please select a valid place from the suggestions.');
      return;
    }
    setError("");

    // Use 12:00 PM if time is unknown, otherwise use the selected TOB
    const finalTob = unknownTime ? "12:00 PM" : tob;

    onSave({
      name: name,
      date_of_birth: dob,
      time_of_birth: finalTob,
      gender: gender,
      birth_place: selectedPlace.formatted,
      birth_lat: selectedPlace.lat.toString(),
      birth_lng: selectedPlace.lon.toString(),
      birth_timezone: selectedPlace.timezone.name,
    });
  };

  return (
    <div>
      {error && (
        <div className={styles.errorBox}>
          {error}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setError("")}
          >
            ✖
          </button>
        </div>
      )}
      <form id="kundli-creation-form" onSubmit={handleSubmit} className={styles.formGrid}>

        {/* Name field */}
        <div className={styles.formField}>
          <label htmlFor="name" className={styles.label}>Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter Your Name"
            required
            disabled={!isEditing}
            className={styles.styledInput}
          />
        </div>

        {/* Gender field */}
        <div className={styles.formField}>
          <label className={styles.label}>Gender</label>
          <select
            value={gender}
            onChange={e => setGender(e.target.value)}
            disabled={!isEditing}
            className={styles.dropdown}
            required
          >
            <option value="" disabled>Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Birth Date */}
        <div className={styles.formField}>
          <label className={styles.label}>Birth Date</label>
          <div className={styles.inputGroup}>
            <select
              value={dob.split("-")[2] || ""}
              onChange={e => setDob(`${dob.split("-")[0] || "2000"}-${dob.split("-")[1] || "01"}-${e.target.value}`)}
              disabled={!isEditing}
              className={styles.dropdown}
              required
            >
              <option value="" disabled>Date</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>
              ))}
            </select>
            <select
              value={dob.split("-")[1] || ""}
              onChange={e => setDob(`${dob.split("-")[0] || "2000"}-${e.target.value}-${dob.split("-")[2] || "01"}`)}
              disabled={!isEditing}
              className={styles.dropdown}
              required
            >
              <option value="" disabled>Month</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {new Date(0, i).toLocaleString("default", { month: "short" })}
                </option>
              ))}
            </select>
            <select
              value={dob.split("-")[0] || ""}
              onChange={e => setDob(`${e.target.value}-${dob.split("-")[1] || "01"}-${dob.split("-")[2] || "01"}`)}
              disabled={!isEditing}
              className={styles.dropdown}
              required
            >
              <option value="" disabled>Year</option>
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
        </div>
        
        {/* Birth Time with Checkbox */}
        <div className={styles.formField}>
           {/* Flex header to hold Label and Checkbox together */}
           <div className={styles.labelRow}>
             <label className={styles.label}>Birth Time</label>
             
             {/* --- CHECKBOX --- */}
             <label className={styles.checkboxLabel}>
                <input 
                    type="checkbox" 
                    checked={unknownTime} 
                    onChange={handleUnknownTimeChange}
                    disabled={!isEditing}
                    className={styles.checkboxInput}
                />
                <span className={styles.checkboxText}>Don't know your birth time</span>
             </label>
          </div>

          <div className={`${styles.inputGroup} ${unknownTime ? styles.disabledGroup : ''}`}>
            <select
              value={tob.split(":")[0] || "01"}
              onChange={e => setTob(`${e.target.value}:${tob.split(":")[1]?.split(" ")[0] || "00"} ${tob.split(" ")[1] || "AM"}`)}
              disabled={!isEditing || unknownTime}
              className={styles.dropdown}
              required={!unknownTime}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>{String(i + 1).padStart(2, "0")}</option>
              ))}
            </select>
            <select
              value={tob.split(":")[1]?.split(" ")[0] || "00"}
              onChange={e => setTob(`${tob.split(":")[0] || "01"}:${e.target.value} ${tob.split(" ")[1] || "AM"}`)}
              disabled={!isEditing || unknownTime}
              className={styles.dropdown}
              required={!unknownTime}
            >
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>
              ))}
            </select>
            <select
              value={tob.split(" ")[1] || "AM"}
              onChange={e => setTob(`${tob.split(":")[0] || "01"}:${tob.split(":")[1]?.split(" ")[0] || "00"} ${e.target.value}`)}
              disabled={!isEditing || unknownTime}
              className={styles.dropdown}
              required={!unknownTime}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        {/* Birth Place */}
        <div className={styles.formField}>
          <label htmlFor="place" className={styles.label}>Birth Place</label>
          <div className={styles.autocompleteWrapper}>
            <input
              id="place"
              type="text"
              value={placeQuery}
              onChange={handlePlaceQueryChange}
              placeholder="Enter place of birth"
              required
              disabled={!isEditing}
              className={styles.styledInput}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className={styles.suggestionsList}>
                {suggestions.map(feature => (
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

        {/* CTA Button */}
        <div className={styles.ctaButtonContainer}>
          <button
            type="submit"
            form="kundli-creation-form"
            className={`${styles.ctaButton} kundliSection_ctaButton`}
            disabled={isSaving || !isEditing}
          >
            {isSaving ? 'Creating...' : 'Get your Kundli'}
          </button>
        </div>
      </form>
    </div>
  );
}