import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Price {
  id: number;
  plan_id: string;
  currency: string;
  amount: number;
  gateway_price_id?: string | null;
}

interface Settings {
  id: number;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

interface ServicePrice {
  id: string;
  service_key: string;
  currency_code: string;
  price_amount: number;
  variant_name: string;
}

// Usage services shown in the pricing editor (backed by service_prices table).
const USAGE_SERVICES: { key: string; label: string; unit: string }[] = [
  { key: 'chat_message', label: 'Chat', unit: 'per message' },
  { key: 'voice_call_minute', label: 'Voice Call', unit: 'per minute' },
  { key: 'remedy', label: 'Remedies', unit: 'per request' },
  { key: 'report_premium', label: 'Report (Premium)', unit: 'per report' },
  { key: 'tarot_draw', label: 'Tarot Draw', unit: 'per draw (non-premium)' },
  { key: 'kundli_matching', label: 'Kundli Matching', unit: 'per match (non-premium)' },
  { key: 'dosha_report', label: 'Dosha Report', unit: 'per report (non-premium)' },
  { key: 'numerology', label: 'Numerology', unit: 'per report (non-premium)' },
  { key: 'gemstone', label: 'Gemstone/Rudraksha', unit: 'per report (non-premium)' },
];
const USAGE_CURRENCIES = ['INR', 'USD', 'AED'];
const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', AED: 'د.إ' };

// Legacy pricing keys that used to live in the generic `settings` table but are
// no longer used for real deduction/display (the app reads service_prices via
// the Usage Pricing section above). Hidden here so admins don't edit dead values
// that conflict with the real per-currency prices.
const HIDDEN_LEGACY_SETTING_KEYS = new Set(['call_coin_cost', 'chat_coin_cost', 'topup_price_per_coin_minor']);

export default function PriceManager() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [settings, setSettings] = useState<Settings[]>([]);
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [spEdits, setSpEdits] = useState<Record<string, string>>({});
  const [spSaving, setSpSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [editingSetting, setEditingSetting] = useState<Settings | null>(null);
  const [showSettingForm, setShowSettingForm] = useState(false);

  const [priceFormData, setPriceFormData] = useState({
    plan_id: 'monthly',
    currency: 'inr',
    amount: 0,
    gateway_price_id: ''
  });

  const [settingFormData, setSettingFormData] = useState({
    key: '',
    value: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
    // Realtime: auto-refresh when prices or settings change anywhere
    const channel = supabase
      .channel('realtime-admin-prices-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prices' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_prices' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      const [pricesResult, settingsResult, servicePricesResult] = await Promise.all([
        supabase.from('prices').select('id, plan_id, currency, amount, gateway_price_id').order('plan_id', { ascending: true }),
        supabase.from('settings').select('*').order('key', { ascending: true }),
        supabase.from('service_prices').select('id, service_key, currency_code, price_amount, variant_name')
      ]);

      if (pricesResult.error) throw pricesResult.error;
      if (settingsResult.error) throw settingsResult.error;

      setPrices(pricesResult.data || []);
      setSettings(settingsResult.data || []);
      if (!servicePricesResult.error) setServicePrices((servicePricesResult.data as ServicePrice[]) || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(error?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingPrice) {
        const { error } = await supabase
          .from('prices')
          .update({
            ...priceFormData
          })
          .eq('id', editingPrice.id);

        if (error) throw error;
        toast.success('Price updated successfully');
      } else {
        const { error } = await supabase
          .from('prices')
          .insert([{
            ...priceFormData
          }]);

        if (error) throw error;
        toast.success('Price created successfully');
      }

      resetPriceForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving price:', error);
      toast.error(error?.message || 'Failed to save price');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSetting) {
        const { error } = await supabase
          .from('settings')
          .update({
            ...settingFormData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSetting.id);

        if (error) throw error;
        toast.success('Setting updated successfully');
      } else {
        const { error } = await supabase
          .from('settings')
          .insert([{
            ...settingFormData,
            updated_at: new Date().toISOString()
          }]);

        if (error) throw error;
        toast.success('Setting created successfully');
      }

      resetSettingForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving setting:', error);
      toast.error(error?.message || 'Failed to save setting');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrice = (price: Price) => {
    setEditingPrice(price);
    setPriceFormData({
      currency: (price.currency || 'usd') as any,
      amount: price.amount,
      gateway_price_id: price.gateway_price_id || ''
    });
    setShowPriceForm(true);
  };

  const handleEditSetting = (setting: Settings) => {
    setEditingSetting(setting);
    setSettingFormData({
      key: setting.key,
      value: setting.value,
      description: setting.description || ''
    });
    setShowSettingForm(true);
  };

  const handleDeletePrice = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this price?')) return;

    try {
      const { error } = await supabase
        .from('prices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Price deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting price:', error);
      toast.error(error?.message || 'Failed to delete price');
    }
  };

  const handleDeleteSetting = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this setting?')) return;

    try {
      const { error } = await supabase
        .from('settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Setting deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting setting:', error);
      toast.error(error?.message || 'Failed to delete setting');
    }
  };

  // No status toggle – schema does not include is_active. Use description/amount edits instead.

  const resetPriceForm = () => {
    setPriceFormData({
      plan_id: 'monthly',
      currency: 'inr',
      amount: 0,
      gateway_price_id: ''
    });
    setEditingPrice(null);
    setShowPriceForm(false);
  };

  const resetSettingForm = () => {
    setSettingFormData({
      key: '',
      value: '',
      description: ''
    });
    setEditingSetting(null);
    setShowSettingForm(false);
  };

  const upsertSettingValue = async (key: string, value: string, description: string) => {
    const sanitized = value.replace(/[^0-9]/g, '') || '0';
    setLoading(true);
    try {
      const existing = settings.find((setting) => setting.key === key);
      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: sanitized, description, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        toast.success('Setting updated successfully');
      } else {
        const { error } = await supabase
          .from('settings')
          .insert([{ key, value: sanitized, description, updated_at: new Date().toISOString() }]);
        if (error) throw error;
        toast.success('Setting created successfully');
      }
      fetchData();
    } catch (error: any) {
      console.error('Error saving setting:', error);
      toast.error(error?.message || 'Failed to save setting');
    } finally {
      setLoading(false);
    }
  };

  // Current stored amount (minor units) for a service+currency (control variant preferred).
  const currentServiceMinor = (serviceKey: string, currency: string): number | null => {
    const rows = servicePrices.filter(sp => sp.service_key === serviceKey && sp.currency_code === currency);
    const control = rows.find(r => r.variant_name === 'control') || rows[0];
    return control ? control.price_amount : null;
  };

  // Save a service price. Admin enters MAJOR units (e.g. 15 for ₹15); we store
  // minor units (1500). Updates ALL variant rows for that service+currency so
  // they stay in sync, or inserts a control row if none exist.
  const saveServicePrice = async (serviceKey: string, currency: string) => {
    const editKey = `${serviceKey}:${currency}`;
    const raw = spEdits[editKey];
    if (raw === undefined || raw === '') return;
    const major = parseFloat(raw);
    if (isNaN(major) || major < 0) { toast.error('Enter a valid amount'); return; }
    const minor = Math.round(major * 100);
    setSpSaving(editKey);
    try {
      const rows = servicePrices.filter(sp => sp.service_key === serviceKey && sp.currency_code === currency);
      if (rows.length > 0) {
        // .select() so we can detect a silently-blocked write (0 rows = RLS/permission issue).
        const { data: updated, error } = await supabase.from('service_prices')
          .update({ price_amount: minor })
          .eq('service_key', serviceKey).eq('currency_code', currency)
          .select();
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error('Update was blocked (no rows changed). You may not have admin permission.');
        }
      } else {
        const { data: inserted, error } = await supabase.from('service_prices')
          .insert([{ service_key: serviceKey, currency_code: currency, price_amount: minor, variant_name: 'control' }])
          .select();
        if (error) throw error;
        if (!inserted || inserted.length === 0) {
          throw new Error('Insert was blocked. You may not have admin permission.');
        }
      }
      toast.success(`${serviceKey.replace('_', ' ')} (${currency}) updated`);
      setSpEdits(prev => { const n = { ...prev }; delete n[editKey]; return n; });
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update price');
    } finally {
      setSpSaving(null);
    }
  };

  if (loading && prices.length === 0 && settings.length === 0) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#eaeaea' }}>
      {/* Prices Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#ffffff' }}>Coin Prices</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={fetchData}
              style={{
                padding: '10px 20px',
                backgroundColor: '#117a8b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
            <button
              onClick={() => setShowPriceForm(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1a73e8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Add New Price
            </button>
          </div>
        </div>

        <div style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#161616', color: '#cfcfcf' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Plan</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Currency</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Gateway Price ID</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((price) => (
                <tr key={price.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#ffffff' }}>{(price.plan_id || '').toUpperCase()}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#ffffff' }}>{(price.currency || '').toUpperCase()}</td>
                  <td style={{ padding: '12px', color: '#eaeaea' }}>{price.amount}</td>
                  <td style={{ padding: '12px', color: '#eaeaea', fontFamily: 'monospace' }}>{price.gateway_price_id || '-'}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditPrice(price)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#1a73e8',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePrice(price.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#b02a37',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {prices.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#b5b5b5' }}>
              No prices configured. Click "Add New Price" to create your first pricing tier.
            </div>
          )}
        </div>
      </div>

      {/* Usage Pricing Section — edits the REAL service_prices table used for
          deduction + display (chat, call, remedies). */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ color: '#ffffff' }}>Usage Pricing (Chat / Call / Remedies)</h3>
          <button onClick={fetchData} style={{ padding: '8px 16px', backgroundColor: '#117a8b', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Refresh</button>
        </div>
        <p style={{ marginTop: 0, marginBottom: '16px', fontSize: '13px', color: '#b5b5b5' }}>
          Enter the amount a user pays per action, in the main currency unit (e.g. 15 = ₹15 / $15).
          Saving updates every pricing variant for that service &amp; currency, and is used both for
          deduction and for the price shown to users.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {USAGE_SERVICES.map(svc => (
            <div key={svc.key} style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', padding: '18px', border: '1px solid #2a2a2a', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, color: '#E5B45B' }}>{svc.label}</h4>
                <span style={{ fontSize: '12px', color: '#8f8284' }}>{svc.unit}</span>
              </div>
              {USAGE_CURRENCIES.map(cur => {
                const editKey = `${svc.key}:${cur}`;
                const stored = currentServiceMinor(svc.key, cur);
                const storedMajor = stored != null ? (stored / 100).toString() : '';
                const value = spEdits[editKey] !== undefined ? spEdits[editKey] : storedMajor;
                const dirty = spEdits[editKey] !== undefined && spEdits[editKey] !== storedMajor;
                return (
                  <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ width: '42px', color: '#cfcfcf', fontWeight: 700 }}>{cur}</span>
                    <span style={{ color: '#8f8284' }}>{CURRENCY_SYMBOL[cur] || ''}</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={value}
                      onChange={(e) => setSpEdits(prev => ({ ...prev, [editKey]: e.target.value }))}
                      style={{ width: '100px', padding: '8px', border: `1px solid ${dirty ? '#E5B45B' : '#2a2a2a'}`, borderRadius: '4px', fontSize: '15px', backgroundColor: '#161616', color: '#fff' }}
                    />
                    <button
                      onClick={() => saveServicePrice(svc.key, cur)}
                      disabled={!dirty || spSaving === editKey}
                      style={{ padding: '7px 14px', backgroundColor: dirty ? '#28a745' : '#3a3a3a', color: '#fff', border: 'none', borderRadius: '4px', cursor: dirty ? 'pointer' : 'not-allowed', fontSize: '13px' }}
                    >
                      {spSaving === editKey ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                );
              })}
              {USAGE_CURRENCIES.every(cur => currentServiceMinor(svc.key, cur) == null) && (
                <p style={{ fontSize: '12px', color: '#b5b5b5', margin: '4px 0 0' }}>No price set yet — enter a value and Save to create it.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ color: '#ffffff' }}>System Settings</h3>
          <button
            onClick={() => setShowSettingForm(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Add New Setting
          </button>
        </div>
        <p style={{ marginTop: 0, marginBottom: '16px', fontSize: '13px', color: '#b5b5b5' }}>
          Chat &amp; call rates are managed in the <strong>Usage Pricing</strong> section above (per currency).
          The old <code>chat_coin_cost</code> / <code>call_coin_cost</code> keys are hidden here as they no longer drive live pricing.
        </p>

        <div style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#161616', color: '#cfcfcf' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Key</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Value</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.filter((setting) => !HIDDEN_LEGACY_SETTING_KEYS.has(setting.key)).map((setting) => (
                <tr key={setting.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#ffffff' }}>{setting.key}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: '#eaeaea' }}>{setting.value}</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#b5b5b5' }}>{setting.description}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditSetting(setting)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#1a73e8',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSetting(setting.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#b02a37',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {settings.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#b5b5b5' }}>
              No settings configured. Click "Add New Setting" to create your first setting.
            </div>
          )}
        </div>
      </div>

      {/* Price Form Modal */}
      {showPriceForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h4>{editingPrice ? 'Edit Price' : 'Create New Price'}</h4>
            <form onSubmit={handlePriceSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Plan:</label>
                <select
                  value={priceFormData.plan_id}
                  onChange={(e) => setPriceFormData({ ...priceFormData, plan_id: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Currency:</label>
                <select
                  value={priceFormData.currency}
                  onChange={(e) => setPriceFormData({ ...priceFormData, currency: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="inr">INR (₹)</option>
                  <option value="usd">USD ($)</option>
                  <option value="eur">EUR (€)</option>
                  <option value="gbp">GBP (£)</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Amount (minor units e.g., cents/paise):</label>
                <input
                  type="number"
                  step="1"
                  value={priceFormData.amount}
                  onChange={(e) => setPriceFormData({ ...priceFormData, amount: parseInt(e.target.value) || 0 })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Gateway Price ID (Stripe/Razorpay):</label>
                <input
                  type="text"
                  value={priceFormData.gateway_price_id}
                  onChange={(e) => setPriceFormData({ ...priceFormData, gateway_price_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Saving...' : (editingPrice ? 'Update' : 'Create')}
                </button>
                <button
                  type="button"
                  onClick={resetPriceForm}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Setting Form Modal */}
      {showSettingForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h4>{editingSetting ? 'Edit Setting' : 'Create New Setting'}</h4>
            <form onSubmit={handleSettingSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Key:</label>
                <input
                  type="text"
                  value={settingFormData.key}
                  onChange={(e) => setSettingFormData({ ...settingFormData, key: e.target.value })}
                  required
                  disabled={!!editingSetting}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: editingSetting ? '#f5f5f5' : 'white'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Value:</label>
                <input
                  type="text"
                  value={settingFormData.value}
                  onChange={(e) => setSettingFormData({ ...settingFormData, value: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description:</label>
                <input
                  type="text"
                  value={settingFormData.description}
                  onChange={(e) => setSettingFormData({ ...settingFormData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Saving...' : (editingSetting ? 'Update' : 'Create')}
                </button>
                <button
                  type="button"
                  onClick={resetSettingForm}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}