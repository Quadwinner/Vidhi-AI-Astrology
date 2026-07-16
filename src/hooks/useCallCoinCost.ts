import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useCallCoinCost(defaultValue = 20) {
  const [callCoinCost, setCallCoinCost] = useState<number>(defaultValue);

  useEffect(() => {
    let isMounted = true;

    const applyValue = (value: unknown) => {
      if (!isMounted) return;
      const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setCallCoinCost(parsed);
      } else {
        setCallCoinCost(defaultValue);
      }
    };

    const fetchCost = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'call_coin_cost')
          .maybeSingle();

        if (error) throw error;

        if (data?.value !== undefined) {
          applyValue(data.value);
        }
      } catch (_) {
        // ignore errors and keep current value
      }
    };

    fetchCost();

    const channel = supabase
      .channel('call-coin-cost-listener')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.call_coin_cost' },
        (payload) => {
          const newValue = payload.new?.value ?? payload.old?.value;
          applyValue(newValue);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [defaultValue]);

  return callCoinCost;
}
