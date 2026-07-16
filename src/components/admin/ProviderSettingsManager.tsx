import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface ProviderSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description?: string;
  updated_at: string;
}

export default function ProviderSettingsManager() {
  const [settings, setSettings] = useState<ProviderSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSetting, setEditingSetting] = useState<ProviderSetting | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    setting_key: '',
    setting_value: '',
    description: ''
  });

  useEffect(() => {
    fetchSettings();
    // Realtime updates
    const channel = supabase
      .channel('realtime-provider-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_settings' }, () => fetchSettings())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_settings')
        .select('*')
        .order('setting_key', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error(error?.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSetting) {
        const { error } = await supabase
          .from('provider_settings')
          .update({
            setting_value: formData.setting_value,
            description: formData.description
          })
          .eq('id', editingSetting.id);

        if (error) throw error;
        toast.success('Setting updated successfully');
      } else {
        const { error } = await supabase
          .from('provider_settings')
          .insert([{
            setting_key: formData.setting_key,
            setting_value: formData.setting_value,
            description: formData.description
          }]);

        if (error) throw error;
        toast.success('Setting created successfully');
      }

      resetForm();
      fetchSettings();
    } catch (error: any) {
      console.error('Error saving setting:', error);
      toast.error(error?.message || 'Failed to save setting');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: ProviderSetting) => {
    setEditingSetting(setting);
    setFormData({
      setting_key: setting.setting_key,
      setting_value: setting.setting_value,
      description: setting.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this setting?')) return;

    try {
      const { error } = await supabase
        .from('provider_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Setting deleted successfully');
      fetchSettings();
    } catch (error: any) {
      console.error('Error deleting setting:', error);
      toast.error(error?.message || 'Failed to delete setting');
    }
  };

  const handleProviderToggle = async (provider: string) => {
    try {
      // Check if setting exists
      const existingSetting = settings.find(s => s.setting_key === 'default_call_provider');

      if (existingSetting) {
        // Update existing setting
        const { error } = await supabase
          .from('provider_settings')
          .update({ setting_value: provider })
          .eq('id', existingSetting.id);

        if (error) throw error;
        toast.success(`Call provider switched to ${getProviderDisplayName(provider)}`);
      } else {
        // Create new setting
        const { error } = await supabase
          .from('provider_settings')
          .insert([{
            setting_key: 'default_call_provider',
            setting_value: provider,
            description: `Default call provider for all users (${provider})`
          }]);

        if (error) throw error;
        toast.success(`Call provider set to ${getProviderDisplayName(provider)}`);
      }

      fetchSettings();
    } catch (error: any) {
      console.error('Error toggling provider:', error);
      toast.error(error?.message || 'Failed to update call provider');
    }
  };

  const resetForm = () => {
    setEditingSetting(null);
    setFormData({ setting_key: '', setting_value: '', description: '' });
    setShowForm(false);
  };

  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case 'agora': return 'Agora AI Call';
      case 'custom': return 'Custom Call Provider';
      default: return provider;
    }
  };

  const getProviderDescription = (provider: string) => {
    switch (provider) {
      case 'agora': return 'Real-time audio/video calls with AI integration';
      case 'custom': return 'Custom call provider implementation';
      default: return 'Unknown provider';
    }
  };

  if (loading && settings.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading provider settings...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#fff', marginBottom: '10px' }}>Call Provider Settings</h2>
        <p style={{ color: '#b5b5b5', marginBottom: '20px' }}>
          Control which call provider all users will use. This overrides individual user selection.
        </p>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: '#7db2ff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Add New Setting
        </button>
      </div>

      {/* Provider Toggle */}
      <div style={{
        background: '#1f1f1f',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #333'
      }}>
        <h3 style={{ color: '#7db2ff', marginBottom: '20px' }}>Call Provider Toggle</h3>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {['agora'].map((provider) => {
            const isActive = settings.find(s => s.setting_key === 'default_call_provider')?.setting_value === provider;
            return (
              <div
                key={provider}
                onClick={() => handleProviderToggle(provider)}
                style={{
                  background: isActive ? '#7db2ff' : '#2a2a2a',
                  color: isActive ? '#fff' : '#b5b5b5',
                  padding: '15px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: isActive ? '2px solid #7db2ff' : '2px solid #444',
                  transition: 'all 0.3s ease',
                  minWidth: '120px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {getProviderDisplayName(provider)}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {getProviderDescription(provider)}
                </div>
                {isActive && (
                  <div style={{ fontSize: '10px', marginTop: '5px', opacity: 0.9 }}>
                    ✓ ACTIVE
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
          Click any provider above to set it as the default for all users
        </div>
      </div>

      {/* Settings List */}
      <div style={{ background: '#1f1f1f', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{
          background: '#2a2a2a',
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 2fr 100px',
          gap: '15px',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          <div>Setting Key</div>
          <div>Value</div>
          <div>Description</div>
          <div>Actions</div>
        </div>

        {settings.map((setting) => (
          <div
            key={setting.id}
            style={{
              padding: '15px 20px',
              borderBottom: '1px solid #333',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 2fr 100px',
              gap: '15px',
              alignItems: 'center'
            }}
          >
            <div style={{ color: '#fff', fontWeight: '500' }}>{setting.setting_key}</div>
            <div style={{ color: '#7db2ff' }}>
              {setting.setting_key === 'default_call_provider'
                ? getProviderDisplayName(setting.setting_value)
                : setting.setting_value
              }
            </div>
            <div style={{ color: '#b5b5b5' }}>{setting.description || '-'}</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => handleEdit(setting)}
                style={{
                  background: '#4a9eff',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(setting.id)}
                style={{
                  background: '#ff4757',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1f1f1f',
            padding: '30px',
            borderRadius: '8px',
            width: '500px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>
              {editingSetting ? 'Edit Setting' : 'Add New Setting'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#b5b5b5', marginBottom: '5px' }}>
                  Setting Key
                </label>
                <input
                  type="text"
                  value={formData.setting_key}
                  onChange={(e) => setFormData({ ...formData, setting_key: e.target.value })}
                  disabled={editingSetting?.setting_key === 'default_call_provider'}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#b5b5b5', marginBottom: '5px' }}>
                  Setting Value
                </label>
                {formData.setting_key === 'default_call_provider' ? (
                  <select
                    value={formData.setting_value}
                    onChange={(e) => setFormData({ ...formData, setting_value: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                    required
                  >
                    <option value="">Select Provider</option>
                    <option value="agora">Agora AI Call</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.setting_value}
                    onChange={(e) => setFormData({ ...formData, setting_value: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                    required
                  />
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#b5b5b5', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    background: '#444',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: '#7db2ff',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Saving...' : (editingSetting ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
