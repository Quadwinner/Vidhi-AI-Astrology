// src/context/PricingContext.tsx

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { amplitudeApp } from '../index'; // Make sure this path is correct for your project structure

// --- INTERFACES (No changes here) ---
interface ServicePrice {
  service_key: string;
  price_amount: number;
}

interface WalletPackage {
  id: string;
  amount: number;
  price: number;
  is_popular: boolean;
}

// --- MODIFIED CONTEXT TYPE ---
interface PricingContextType {
  prices: Record<string, number>;
  packages: WalletPackage[];
  currencySymbol: string;
  formatPrice: (amount: number) => string;
  isLoading: boolean;
  variant: string; // <-- NEW: Expose the variant name for debugging or advanced logic
  showSubscriptions: boolean; // <-- NEW: The critical feature flag
  variantIsLoading: boolean;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

// --- NEW: The flag key from your Amplitude dashboard ---
const MONETIZATION_FLAG_KEY = "pricingexperiment";
const CONTROL_VARIANT_NAME = 'control';

export const PricingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, currency, checkingStatus, pricingVariant: userVariantFromAuth } = useAuth();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [packages, setPackages] = useState<WalletPackage[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  // const [variantIsLoading, setVariantIsLoading] = useState(true);

  // --- NEW: EXPERIMENT STATE ---
  const [variant, setVariant] = useState('control'); // Default to 'control' for safety
  const [showSubscriptions, setShowSubscriptions] = useState(true);
  const [variantIsLoading, setVariantIsLoading] = useState(true);
  // src/context/PricingContext.tsx

  // --- ACTION 2: REPLACE THE ENTIRE FIRST useEffect HOOK ---
  useEffect(() => {
    const determineVariant = async () => {
      setVariantIsLoading(true);
      if (user && userVariantFromAuth) {
        // CASE 1: USER IS LOGGED IN
        console.log(`[PricingContext] Received stable variant from AuthContext: ${userVariantFromAuth}`);
        setVariant(userVariantFromAuth);

        // --- ADD THIS LINE ---
        setShowSubscriptions(userVariantFromAuth === CONTROL_VARIANT_NAME);

      } else {
        // CASE 2: USER IS A GUEST
        try {
          console.log(`[PricingContext] Guest user detected. Fetching temporary variant from Amplitude.`);
          await amplitudeApp.experiment.fetch();
          const expVariant = amplitudeApp.experiment.variant(MONETIZATION_FLAG_KEY);
          const guestVariant = expVariant?.value || 'control';
          setVariant(guestVariant);
          sessionStorage.setItem('guestVariant', guestVariant);
          console.log(`[PricingContext] Guest assigned to temporary variant: ${guestVariant}`);

          // --- AND ADD THIS LINE ---
          setShowSubscriptions(guestVariant === CONTROL_VARIANT_NAME);

        } catch (e) {
          console.error("[PricingContext] Amplitude Experiment Fetch Error (Guest):", e);
          setVariant('control');
          // --- ALSO ADD A FALLBACK HERE ---
          setShowSubscriptions(true);
        }
      }
      setVariantIsLoading(false);
    };

    if (!checkingStatus) {
      determineVariant();
    }

  }, [user, checkingStatus, userVariantFromAuth]);

  // This useEffect for fetching pricing data is mostly the same, but now depends on the reactive `variant`
  useEffect(() => {
    if (!currency || !variant) {
      setIsLoading(false);
      return;
    }

    const fetchPricingData = async () => {
      setIsLoading(true);
      try {
        const { data: currData } = await supabase
          .from('supported_currencies')
          .select('symbol, decimal_places')
          .eq('code', currency)
          .single();

        if (currData) {
          setCurrencySymbol(currData.symbol);
          setDecimalPlaces(currData.decimal_places);
        }

        const { data: priceData, error: priceError } = await supabase
          .from('service_prices')
          .select('service_key, price_amount')
          .eq('currency_code', currency)
          .eq('variant_name', variant);

        if (priceError) throw priceError;
        if (priceData) {
          const priceMap: Record<string, number> = {};
          priceData.forEach(p => { priceMap[p.service_key] = p.price_amount; });
          setPrices(priceMap);
        }

        const { data: pkgData, error: pkgError } = await supabase
          .from('wallet_packages')
          .select('*')
          .eq('currency_code', currency)
          .eq('is_active', true)
          .eq('variant_name', variant)
          .order('display_order', { ascending: true });

        if (pkgError) throw pkgError;
        if (pkgData) setPackages(pkgData);

      } catch (error) {
        console.error('Error loading pricing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPricingData();
  }, [currency, variant]); // <-- This correctly re-runs when the variant changes after login

  // --- HELPER FUNCTION (No changes here) ---
  const formatPrice = (amount: number) => {
    if (amount === undefined || amount === null) return '...';
    const majorValue = amount / 100;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(majorValue);
  };

  // --- MODIFIED PROVIDER VALUE ---
  return (
    <PricingContext.Provider value={{ prices, packages, currencySymbol, formatPrice, isLoading, variant, showSubscriptions, variantIsLoading }}>
      {children}
    </PricingContext.Provider>
  );
};

export const usePricing = () => {
  const context = useContext(PricingContext);
  if (context === undefined) throw new Error('usePricing must be used within a PricingProvider');
  return context;
};