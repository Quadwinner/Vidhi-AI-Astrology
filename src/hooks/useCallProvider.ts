// Hook to get the admin-selected call provider
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useCallProvider = () => {
  const [provider, setProvider] = useState<'agora' | 'custom' | null>('agora');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const { data, error } = await supabase
          .from('provider_settings')
          .select('setting_value')
          .eq('setting_key', 'default_call_provider')
          .single();

        if (error) {
          // If table doesn't exist or no setting found, use default
          if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
            console.log('Using default call provider: agora');
            setProvider('agora');
          } else {
            console.error('Error fetching call provider:', error);
            setProvider('agora');
          }
        } else {
          setProvider(data?.setting_value as 'agora' | 'custom' || 'agora');
        }
      } catch (error) {
        console.error('Error fetching call provider:', error);
        setProvider('agora');
      }
    };

    fetchProvider();

    // Subscribe to real-time changes (only if table exists)
    const channel = supabase
      .channel('provider-settings-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'provider_settings' },
        () => fetchProvider()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { provider, loading };
};
