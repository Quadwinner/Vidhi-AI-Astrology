import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface SyncStats {
  totalUsers: number;
  premiumUsers: number;
  pushEnabledUsers: number;
  activeUsers: number;
  lastSyncCount: number;
  lastSyncDate: string | null;
}

interface SyncLog {
  id: string;
  user_id: string;
  status: string;
  synced_at: string;
  synced_properties_count: number;
  error_message?: string;
}

export default function CleverTapSyncManager() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [recentSyncs, setRecentSyncs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'premium' | 'push_enabled' | 'active'>('premium');
  const [batchLimit, setBatchLimit] = useState(100);
  const [singleUserId, setSingleUserId] = useState('');
  const [paymentSyncing, setPaymentSyncing] = useState(false);
  const [paymentDays, setPaymentDays] = useState(30);

  useEffect(() => {
    loadStats();
    loadRecentSyncs();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get premium users
      const { count: premiumUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .in('plan_tier', ['monthly', 'yearly']);

      // Get push-enabled users
      const { count: pushEnabledUsers } = await supabase
        .from('user_notification_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('notification_enabled', true);

      // Get active users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activeChats } = await supabase
        .from('chat_history')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const activeUsers = activeChats ? new Set(activeChats.map(c => c.user_id)).size : 0;

      // Get last sync stats (optional - may not exist yet)
      let lastSyncDate = null;
      let lastSyncCount = 0;

      try {
        const { data: lastSync } = await supabase
          .from('clevertap_sync_logs')
          .select('synced_at')
          .order('synced_at', { ascending: false })
          .limit(1)
          .single();

        if (lastSync) {
          lastSyncDate = lastSync.synced_at;

          const { count } = await supabase
            .from('clevertap_sync_logs')
            .select('*', { count: 'exact', head: true })
            .gte('synced_at', lastSync.synced_at);

          lastSyncCount = count || 0;
        }
      } catch (syncLogError) {
        console.warn('Could not load sync stats (table may not exist yet):', syncLogError);
      }

      setStats({
        totalUsers: totalUsers || 0,
        premiumUsers: premiumUsers || 0,
        pushEnabledUsers: pushEnabledUsers || 0,
        activeUsers,
        lastSyncCount,
        lastSyncDate
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSyncs = async () => {
    try {
      const { data, error } = await supabase
        .from('clevertap_sync_logs')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Failed to load recent syncs (table may not exist yet):', error);
        setRecentSyncs([]);
        return;
      }
      setRecentSyncs(data || []);
    } catch (error) {
      console.warn('Failed to load recent syncs:', error);
      setRecentSyncs([]);
    }
  };

  const handleSyncSingleUser = async () => {
    if (!singleUserId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-user-to-clevertap', {
        body: { user_id: singleUserId.trim() }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`User synced successfully! (${data.synced_properties} properties)`);
        setSingleUserId('');
        loadRecentSyncs();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Failed to sync user');
    } finally {
      setSyncing(false);
    }
  };

  const handleBatchSync = async () => {
    setBatchSyncing(true);
    try {
      toast.loading('Starting batch sync...', { id: 'batch-sync' });

      const { data, error } = await supabase.functions.invoke('batch-sync-users-to-clevertap', {
        body: {
          segment: selectedSegment,
          limit: batchLimit
        }
      });

      if (error) throw error;

      toast.dismiss('batch-sync');

      if (data.success) {
        toast.success(
          `Batch sync completed! Synced: ${data.synced}, Failed: ${data.failed}`,
          { duration: 5000 }
        );

        if (data.failed > 0 && data.errors.length > 0) {
          console.error('Sync errors:', data.errors);
        }

        loadStats();
        loadRecentSyncs();
      } else {
        toast.error(data.error || 'Batch sync failed');
      }
    } catch (error: any) {
      toast.dismiss('batch-sync');
      console.error('Batch sync error:', error);
      toast.error(error.message || 'Failed to sync users');
    } finally {
      setBatchSyncing(false);
    }
  };

  const handleSyncFailedPayments = async () => {
    setPaymentSyncing(true);
    try {
      toast.loading('Syncing failed payments...', { id: 'payment-sync' });

      const { data, error } = await supabase.functions.invoke('sync-failed-recharges-to-clevertap', {
        body: {
          days: paymentDays
        }
      });

      if (error) throw error;

      toast.dismiss('payment-sync');

      if (data.success) {
        toast.success(
          `Payment sync completed! Synced: ${data.synced} failed payments`,
          { duration: 5000 }
        );
        console.log('Payment sync result:', data);
      } else {
        toast.error(data.error || 'Payment sync failed');
      }
    } catch (error: any) {
      toast.dismiss('payment-sync');
      console.error('Payment sync error:', error);
      toast.error(error.message || 'Failed to sync payments');
    } finally {
      setPaymentSyncing(false);
    }
  };

  return (
    <div style={{ padding: 20, color: '#eaeaea' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: '#ffffff' }}>CleverTap User Sync</h3>
        <button
          onClick={loadStats}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: '#2a2a2a',
            color: '#7db2ff',
            border: '1px solid #3a3a3a',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          {loading ? 'Loading...' : '🔄 Refresh Stats'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 15,
          marginBottom: 20
        }}>
          <div style={{
            padding: 15,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Total Users</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7db2ff' }}>{stats.totalUsers}</div>
          </div>
          <div style={{
            padding: 15,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Premium Users</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4caf50' }}>{stats.premiumUsers}</div>
          </div>
          <div style={{
            padding: 15,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Push-Enabled</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ffcf5a' }}>{stats.pushEnabledUsers}</div>
          </div>
          <div style={{
            padding: 15,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Active (30 days)</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fe6c0f' }}>{stats.activeUsers}</div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div style={{
        background: '#2a4a5a',
        border: '1px solid #3a6a7a',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        color: '#eaeaea'
      }}>
        <strong style={{ color: '#7db2ff' }}>ℹ️ Note:</strong> User data is synced to CleverTap for personalized campaigns and segmentation.
        Data includes: plan tier, usage stats, call/chat metrics, payment info, and notification preferences.
      </div>

      {/* Single User Sync */}
      <div style={{
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>Sync Single User</h4>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontSize: 14 }}>
              User ID
            </label>
            <input
              type="text"
              value={singleUserId}
              onChange={(e) => setSingleUserId(e.target.value)}
              placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
              style={{
                padding: 10,
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: '#111',
                color: '#eaeaea',
                width: '100%',
                fontSize: 14
              }}
            />
          </div>
          <button
            onClick={handleSyncSingleUser}
            disabled={syncing || !singleUserId.trim()}
            style={{
              padding: '10px 20px',
              background: syncing || !singleUserId.trim() ? '#555' : '#117a8b',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: syncing || !singleUserId.trim() ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            {syncing ? 'Syncing...' : 'Sync User'}
          </button>
        </div>
      </div>

      {/* Batch Sync */}
      <div style={{
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>Batch Sync Users</h4>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontSize: 14 }}>
            User Segment
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { value: 'premium', label: 'Premium Users', count: stats?.premiumUsers },
              { value: 'push_enabled', label: 'Push-Enabled', count: stats?.pushEnabledUsers },
              { value: 'active', label: 'Active (30d)', count: stats?.activeUsers },
              { value: 'all', label: 'All Users', count: stats?.totalUsers }
            ].map((seg) => (
              <button
                key={seg.value}
                onClick={() => setSelectedSegment(seg.value as any)}
                style={{
                  padding: '10px 15px',
                  background: selectedSegment === seg.value ? '#117a8b' : '#2a2a2a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                {seg.label} ({seg.count})
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontSize: 14 }}>
            Batch Limit (max users to sync)
          </label>
          <input
            type="number"
            value={batchLimit}
            onChange={(e) => setBatchLimit(Math.max(1, parseInt(e.target.value) || 100))}
            min="1"
            style={{
              padding: 10,
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: '#111',
              color: '#eaeaea',
              width: 200,
              fontSize: 14
            }}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>
            Maximum: 1000 users per batch
          </div>
        </div>

        <button
          onClick={handleBatchSync}
          disabled={batchSyncing}
          style={{
            padding: '12px 24px',
            background: batchSyncing ? '#555' : '#117a8b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: batchSyncing ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {batchSyncing ? 'Syncing...' : `Sync ${selectedSegment.replace('_', ' ')} Users`}
        </button>
      </div>

      {/* Payment Events Sync */}
      <div style={{
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>Sync Payment Events</h4>
        <div style={{
          background: '#2a4a5a',
          border: '1px solid #3a6a7a',
          borderRadius: 6,
          padding: 12,
          marginBottom: 15,
          fontSize: 13,
          color: '#eaeaea'
        }}>
          <strong style={{ color: '#7db2ff' }}>Note:</strong> Syncs only FAILED and CANCELLED payments from database to CleverTap.
          Excludes pending/incomplete payments.
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontSize: 14 }}>
            Days to Sync (from today)
          </label>
          <input
            type="number"
            value={paymentDays}
            onChange={(e) => setPaymentDays(Math.max(1, parseInt(e.target.value) || 30))}
            min="1"
            max="365"
            style={{
              padding: 10,
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: '#111',
              color: '#eaeaea',
              width: 200,
              fontSize: 14
            }}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>
            Syncs failed payments from the last {paymentDays} days
          </div>
        </div>

        <button
          onClick={handleSyncFailedPayments}
          disabled={paymentSyncing}
          style={{
            padding: '12px 24px',
            background: paymentSyncing ? '#555' : '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: paymentSyncing ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {paymentSyncing ? 'Syncing...' : '🔄 Sync Failed Payments'}
        </button>
      </div>

      {/* Recent Syncs */}
      <div style={{
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 20
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>Recent User Syncs</h4>
        {recentSyncs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ padding: 10, textAlign: 'left', color: '#cfcfcf', fontSize: 12 }}>User ID</th>
                  <th style={{ padding: 10, textAlign: 'left', color: '#cfcfcf', fontSize: 12 }}>Status</th>
                  <th style={{ padding: 10, textAlign: 'left', color: '#cfcfcf', fontSize: 12 }}>Properties</th>
                  <th style={{ padding: 10, textAlign: 'left', color: '#cfcfcf', fontSize: 12 }}>Synced At</th>
                </tr>
              </thead>
              <tbody>
                {recentSyncs.map((sync) => (
                  <tr key={sync.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: 10, fontSize: 12, fontFamily: 'monospace' }}>
                      {sync.user_id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: 10, fontSize: 12 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: sync.status === 'success' ? '#1f4f1f' : '#4f1f1f',
                        color: sync.status === 'success' ? '#4caf50' : '#f44336',
                        fontSize: 11
                      }}>
                        {sync.status}
                      </span>
                    </td>
                    <td style={{ padding: 10, fontSize: 12 }}>{sync.synced_properties_count}</td>
                    <td style={{ padding: 10, fontSize: 12 }}>
                      {new Date(sync.synced_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#b5b5b5', padding: 20 }}>
            No syncs yet
          </div>
        )}
      </div>
    </div>
  );
}
