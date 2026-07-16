// src/pages/AdminPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from '../components/admin/AdminDashboard';
import BlogManager from '../components/admin/BlogManager';
import PriceManager from '../components/admin/PriceManager';
import UsersManager from '../components/admin/UsersManager';
import PromptsManager from '../components/admin/PromptsManager';
import ProviderSettingsManager from '../components/admin/ProviderSettingsManager';
import PlanEntitlementsManager from '../components/admin/PlanEntitlementsManager';
import CampaignManager from '../components/admin/CampaignManager';
import WebPushCampaignManager from '../components/admin/WebPushCampaignManager';
import CleverTapSyncManager from '../components/admin/CleverTapSyncManager';
import DailyAnalytics from '../components/admin/DailyAnalytics';

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'blogs' | 'prices' | 'users' | 'prompts' | 'providers' | 'plans' | 'campaigns' | 'webpush' | 'clevertap' | 'analytics'>('dashboard');

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#121212',
      paddingTop: '20px',
      color: '#eaeaea'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
        <div style={{
          backgroundColor: '#1f1f1f',
          borderRadius: '10px',
          padding: '30px',
          marginBottom: '20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          border: '1px solid #2a2a2a'
        }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>Admin Dashboard</h1>
          <p style={{ margin: 0, color: '#c9c9c9', fontSize: '16px' }}>
            Signed in as: <strong>{user?.email}</strong>
          </p>
        </div>

        <div style={{
          backgroundColor: '#1b1b1b',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            borderBottom: '1px solid #2a2a2a',
            backgroundColor: '#161616'
          }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'dashboard' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'dashboard' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'dashboard' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('blogs')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'blogs' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'blogs' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'blogs' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'blogs' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              Blog Management
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'prices' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'prices' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'prices' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'prices' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              Price & Settings
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'users' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'users' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'users' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'users' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'prompts' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'prompts' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'prompts' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'prompts' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              Prompts
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'providers' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'providers' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'providers' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'providers' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              Call Providers
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'plans' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'plans' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'plans' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'plans' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              Plan Limits
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'campaigns' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'campaigns' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'campaigns' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'campaigns' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              WhatsApp Campaigns
            </button>
            <button
              onClick={() => setActiveTab('webpush')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'webpush' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'webpush' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'webpush' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'webpush' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              🔔 Web Push Campaigns
            </button>
            <button
              onClick={() => setActiveTab('clevertap')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'clevertap' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'clevertap' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'clevertap' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'clevertap' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              🔄 CleverTap Sync
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '15px 25px',
                background: activeTab === 'analytics' ? '#1f1f1f' : 'transparent',
                color: activeTab === 'analytics' ? '#7db2ff' : '#b5b5b5',
                border: 'none',
                borderBottom: activeTab === 'analytics' ? '2px solid #7db2ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'analytics' ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
            >
              📊 Daily Analytics
            </button>
          </div>

          <div>
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'blogs' && <BlogManager />}
            {activeTab === 'prices' && <PriceManager />}
            {activeTab === 'users' && <UsersManager />}
            {activeTab === 'prompts' && <PromptsManager />}
            {activeTab === 'providers' && <ProviderSettingsManager />}
            {activeTab === 'plans' && <PlanEntitlementsManager />}
            {activeTab === 'campaigns' && <CampaignManager />}
            {activeTab === 'webpush' && <WebPushCampaignManager />}
            {activeTab === 'clevertap' && <CleverTapSyncManager />}
            {activeTab === 'analytics' && <DailyAnalytics />}
          </div>
        </div>
      </div>
    </div>
  );
}



