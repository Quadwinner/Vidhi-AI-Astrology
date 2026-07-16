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

export default function PriceManager() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [settings, setSettings] = useState<Settings[]>([]);
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      const [pricesResult, settingsResult] = await Promise.all([
        supabase.from('prices').select('id, plan_id, currency, amount, gateway_price_id').order('plan_id', { ascending: true }),
        supabase.from('settings').select('*').order('key', { ascending: true })
      ]);

      if (pricesResult.error) throw pricesResult.error;
      if (settingsResult.error) throw settingsResult.error;

      setPrices(pricesResult.data || []);
      setSettings(settingsResult.data || []);
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

      {/* Chat Pricing Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#ffffff' }}>Chat Pricing</h3>
        </div>
        <div style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', border: '1px solid #2a2a2a' }}>
          {(() => {
            const chatCostSetting = settings.find(s => s.key === 'chat_coin_cost');
            return (
              <div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#cfcfcf', fontWeight: 'bold' }}>
                    Coins per Chat Message:
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={chatCostSetting?.value ?? '1'}
                      onChange={async (e) => {
                        await upsertSettingValue(
                          'chat_coin_cost',
                          e.target.value,
                          'Number of coins deducted per chat message'
                        );
                      }}
                      style={{
                        width: '100px',
                        padding: '8px',
                        border: '1px solid #2a2a2a',
                        borderRadius: '4px',
                        fontSize: '16px',
                        backgroundColor: '#161616',
                        color: '#ffffff'
                      }}
                    />
                    <span style={{ color: '#b5b5b5' }}>coins per message</span>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '14px', color: '#b5b5b5' }}>
                    {chatCostSetting?.description || 'Number of coins deducted per chat message'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Call Pricing Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#ffffff' }}>Call Pricing</h3>
        </div>
        <div style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', border: '1px solid #2a2a2a' }}>
          {(() => {
            const callCostSetting = settings.find(s => s.key === 'call_coin_cost');
            return (
              <div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#cfcfcf', fontWeight: 'bold' }}>
                    Coins per Call Minute:
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={callCostSetting?.value ?? '20'}
                      onChange={async (e) => {
                        await upsertSettingValue(
                          'call_coin_cost',
                          e.target.value,
                          'Number of coins deducted per call minute'
                        );
                      }}
                      style={{
                        width: '120px',
                        padding: '8px',
                        border: '1px solid #2a2a2a',
                        borderRadius: '4px',
                        fontSize: '16px',
                        backgroundColor: '#161616',
                        color: '#ffffff'
                      }}
                    />
                    <span style={{ color: '#b5b5b5' }}>coins per minute</span>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '14px', color: '#b5b5b5' }}>
                    {callCostSetting?.description || 'Number of coins deducted per minute of call time'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Settings Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
              {settings.map((setting) => (
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