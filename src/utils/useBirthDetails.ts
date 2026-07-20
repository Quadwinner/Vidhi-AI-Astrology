import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface BirthDetails {
  name: string;
  dob: string;
  tob: string;
  lat: string;
  lon: string;
  tz: string;
  place: string;
}

function toDmy(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function useBirthDetails() {
  const { userProfiles } = useAuth() as any;
  const [details, setDetails] = useState<BirthDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const profile = userProfiles?.[0];
      if (!profile) { if (!cancelled) { setDetails(null); setLoading(false); } return; }
      const { data } = await supabase
        .from('user_birth_details')
        .select('date_of_birth, time_of_birth, birth_place, birth_lat, birth_lng, timezone_offset')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setDetails({
          name: profile.name || '',
          dob: toDmy(data.date_of_birth),
          tob: (data.time_of_birth || '').substring(0, 5),
          lat: data.birth_lat != null ? String(data.birth_lat) : '',
          lon: data.birth_lng != null ? String(data.birth_lng) : '',
          tz: data.timezone_offset != null ? String(data.timezone_offset) : '5.5',
          place: data.birth_place || '',
        });
      } else {
        setDetails({ name: profile.name || '', dob: '', tob: '', lat: '', lon: '', tz: '5.5', place: '' });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userProfiles]);

  return { details, loading };
}
