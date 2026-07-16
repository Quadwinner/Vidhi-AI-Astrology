import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface CampaignResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  categoryBreakdown?: Record<string, number>;
}

export default function CampaignManager() {
  const [campaignType, setCampaignType] = useState<'category' | 'single'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('Love');
  const [templateName, setTemplateName] = useState<string>('astroaura_marketing');
  const [testMode, setTestMode] = useState<boolean>(false);
  const [testPhone, setTestPhone] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [dryRun, setDryRun] = useState<boolean>(false);

  const categories = ['Love', 'Marriage', 'Career', 'Health', 'Money', 'Spiritual'];
  const categoryTemplates: Record<string, string> = {
    Love: 'astroaura_loves_marketing1',      // Campaign name in AiSensy
    Marriage: 'astroaura_marriage_marketing', // Marriage-specific campaign
    Career: 'astroaura_career_marketing',
    Health: 'astroaura_health_marketing',
    Money: 'astroaura_money_marketing',
    Spiritual: 'astroaura_spiritual_marketing',
  };

  const handleSendCampaign = async () => {
    if (testMode && !testPhone.trim()) {
      toast.error('Please enter a test phone number');
      return;
    }

    if (campaignType === 'single' && !templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const payload: any = {
        dryRun: dryRun,
        testMode: testMode,
        useCategoryBased: campaignType === 'category',
      };

      if (testMode) {
        payload.testPhone = testPhone.trim();
      }

      if (campaignType === 'category') {
        payload.filterCategory = selectedCategory;
      } else {
        payload.campaignName = templateName.trim();
      }
      // Allow overriding the template even for category mode
      if (campaignType === 'category' && templateName.trim()) {
        payload.campaignName = templateName.trim();
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-campaign', {
        body: payload
      });

      if (error) throw error;

      if (dryRun) {
        toast.success(`Found ${data.results?.total || 0} recipients`);
        setResult({
          total: data.results?.total || 0,
          success: 0,
          failed: 0,
          errors: [],
          categoryBreakdown: data.results?.categoryBreakdown
        });
      } else {
        toast.success(`Campaign sent! ${data.results?.success || 0} successful, ${data.results?.failed || 0} failed`);
        setResult(data.results);
      }
    } catch (error: any) {
      console.error('Campaign send failed:', error);
      toast.error(error.message || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 20, color: '#eaeaea' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>WhatsApp Campaign Manager</h3>

      <div style={{
        background: '#2a4a5a',
        border: '1px solid #3a6a7a',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        color: '#eaeaea'
      }}>
        <strong style={{ color: '#7db2ff' }}>📱 Note:</strong> Campaigns are sent to all users from WhatsApp sessions, website users, and OTP users. 
        For best delivery rates, ensure users have interacted with your WhatsApp number or have opted in to receive messages.
      </div>

      <div style={{ 
        background: '#1f1f1f', 
        border: '1px solid #2a2a2a', 
        borderRadius: 8, 
        padding: 20,
        marginBottom: 20
      }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf' }}>
            Campaign Type
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setCampaignType('category')}
              style={{
                padding: '10px 20px',
                background: campaignType === 'category' ? '#117a8b' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Category-Based
            </button>
            <button
              onClick={() => setCampaignType('single')}
              style={{
                padding: '10px 20px',
                background: campaignType === 'single' ? '#117a8b' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Single Template
            </button>
          </div>
        </div>

        {campaignType === 'category' ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf' }}>
              Select Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: '#111',
                color: '#eaeaea',
                width: '100%',
                maxWidth: 300
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              <div>Recommended template: <strong>{categoryTemplates[selectedCategory]}</strong></div>
              <div>Sends to users who asked {selectedCategory.toLowerCase()}-related questions.</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#cfcfcf' }}>
                Override Template Name (optional)
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={categoryTemplates[selectedCategory]}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #2a2a2a',
                  background: '#111',
                  color: '#eaeaea',
                  width: '100%',
                  maxWidth: 400
                }}
              />
              <p style={{ marginTop: 6, fontSize: 12, color: '#999' }}>
                Leave blank to use: {categoryTemplates[selectedCategory]}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf' }}>
              Template Name (from AiSensy)
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., AstroAura_Marketing (no spaces, use underscores)"
              style={{
                padding: 10,
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: '#111',
                color: '#eaeaea',
                width: '100%',
                maxWidth: 400
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cfcfcf', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Dry Run (Preview recipients without sending)</span>
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cfcfcf', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Test Mode (Send to single phone number)</span>
          </label>
          {testMode && (
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+919876543210"
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: '#111',
                color: '#eaeaea',
                width: '100%',
                maxWidth: 300
              }}
            />
          )}
        </div>

        <button
          onClick={handleSendCampaign}
          disabled={sending}
          style={{
            padding: '12px 24px',
            background: sending ? '#555' : '#117a8b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: sending ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {dryRun ? 'Preview Recipients' : sending ? 'Sending...' : 'Send Campaign'}
        </button>
      </div>

      {result && (
        <div style={{
          background: '#1f1f1f',
          border: '1px solid #2a2a2a',
          borderRadius: 8,
          padding: 20
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>
            {dryRun ? 'Preview Results' : 'Campaign Results'}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 15 }}>
            <div style={{ padding: 15, background: '#161616', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Total Recipients</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7db2ff' }}>{result.total}</div>
            </div>
            {!dryRun && (
              <>
                <div style={{ padding: 15, background: '#161616', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Successful</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4caf50' }}>{result.success}</div>
                </div>
                <div style={{ padding: 15, background: '#161616', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Failed</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f44336' }}>{result.failed}</div>
                </div>
              </>
            )}
          </div>

          {result.categoryBreakdown && Object.keys(result.categoryBreakdown).length > 0 && (
            <div style={{ marginTop: 15 }}>
              <div style={{ fontSize: 14, color: '#cfcfcf', marginBottom: 10 }}>Category Breakdown:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {Object.entries(result.categoryBreakdown).map(([cat, count]) => (
                  <div key={cat} style={{ padding: '8px 12px', background: '#161616', borderRadius: 6 }}>
                    <span style={{ color: '#999' }}>{cat}: </span>
                    <span style={{ color: '#7db2ff', fontWeight: 'bold' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 15 }}>
              <div style={{ fontSize: 14, color: '#f44336', marginBottom: 10 }}>Errors ({result.errors.length}):</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: '#161616', padding: 10, borderRadius: 6 }}>
                {result.errors.slice(0, 10).map((error, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: '#f44336', marginBottom: 5 }}>
                    {error}
                  </div>
                ))}
                {result.errors.length > 10 && (
                  <div style={{ fontSize: 12, color: '#999' }}>... and {result.errors.length - 10} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

