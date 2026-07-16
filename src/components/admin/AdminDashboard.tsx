import React, { useState, useEffect, useCallback } from 'react';
import { useAdminOperations } from '../../hooks/useAdminOperations';

interface AdminStats {
  totalUsers: number;
  totalBlogs: number;
  activePrices: number;
  totalSettings: number;
  totalChats: number;
  totalCalls: number;
}

interface UserAnalytics {
  planDistribution: Record<string, number>;
  subscriptionStatus: Record<string, number>;
  newUsersLast30Days: number;
  averageCoinBalance: number;
}

type TimeFilter = 'today' | '7days' | '30days' | 'all';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30days');
  const { loading, getStats, getUserAnalytics, exportData } = useAdminOperations();

  const loadDashboardData = useCallback(async () => {
    try {
      // Calculate date range based on filter
      const now = new Date();
      let startDate: Date | undefined;

      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        default:
          startDate = undefined; // No filter
          break;
      }

      // Convert startDate to ISO string for backend
      const startDateISO = startDate?.toISOString();

      const [statsData, analyticsData] = await Promise.all([
        getStats(startDateISO),
        getUserAnalytics(startDateISO)
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }, [getStats, getUserAnalytics, timeFilter]);

  // Note: Removed auto-reload to prevent infinite loop. Click "Refresh Data" button manually after changing filter.

  const handleExport = async (table: 'blogs' | 'users' | 'prices') => {
    try {
      await exportData(table);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  if (loading && !stats) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', color: '#eaeaea', backgroundColor: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h3 style={{ margin: 0, color: '#ffffff' }}>Admin Dashboard</h3>
        <button
          onClick={loadDashboardData}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2e7d32',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Time Filter Buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#1f1f1f',
        borderRadius: '8px',
        border: '1px solid #2a2a2a'
      }}>
        <span style={{ color: '#cfcfcf', marginRight: '10px', alignSelf: 'center' }}>
          Time Period:
        </span>
        {(['today', '7days', '30days', 'all'] as TimeFilter[]).map(filter => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            style={{
              padding: '8px 16px',
              backgroundColor: timeFilter === filter ? '#667eea' : '#2a2a2a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: timeFilter === filter ? 'bold' : 'normal'
            }}
          >
            {filter === 'today' ? 'Today' :
             filter === '7days' ? 'Last 7 Days' :
             filter === '30days' ? 'Last 30 Days' :
             'All Time'}
          </button>
        ))}
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#cfcfcf' }}>Total Users</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#7db2ff' }}>
            {stats?.totalUsers || 0}
          </div>
          <div style={{ fontSize: '14px', color: '#b5b5b5', marginTop: '5px' }}>
            +{analytics?.newUsersLast30Days || 0} in last 30 days
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#cfcfcf' }}>Total Blogs</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#57d57a' }}>
            {stats?.totalBlogs || 0}
          </div>
          <button
            onClick={() => handleExport('blogs')}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#2e7d32',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Export Blogs
          </button>
        </div>

        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#cfcfcf' }}>Total Chats</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffcf5a' }}>
            {stats?.totalChats || 0}
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#cfcfcf' }}>Total Calls</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fe6c0f' }}>
            {stats?.totalCalls || 0}
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#cfcfcf' }}>Active Prices</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffcf5a' }}>
            {stats?.activePrices || 0}
          </div>
          <button
            onClick={() => handleExport('prices')}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#a67c00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Export Prices
          </button>
        </div>

        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#cfcfcf' }}>Settings</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6bd5e3' }}>
            {stats?.totalSettings || 0}
          </div>
          <button
            onClick={() => handleExport('users')}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#117a8b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Export Users
          </button>
        </div>
      </div>

      {/* Analytics Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px'
      }}>
        {/* Plan Distribution */}
        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>Plan Distribution</h4>
          {analytics?.planDistribution && Object.keys(analytics.planDistribution).length > 0 ? (
            <div>
              {Object.entries(analytics.planDistribution).map(([plan, count]) => (
                <div key={plan} style={{ marginBottom: '10px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '5px'
                  }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{plan}</span>
                    <span>{count} users</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(count / (stats?.totalUsers || 1)) * 100}%`,
                      height: '100%',
                      backgroundColor: plan === 'yearly' ? '#28a745' : plan === 'monthly' ? '#007bff' : '#6c757d',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
                  <div style={{ textAlign: 'center', color: '#b5b5b5', padding: '20px' }}>
              No plan data available
            </div>
          )}
        </div>

        {/* Subscription Status */}
        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>Subscription Status</h4>
          {analytics?.subscriptionStatus && Object.keys(analytics.subscriptionStatus).length > 0 ? (
            <div>
              {Object.entries(analytics.subscriptionStatus).map(([status, count]) => (
                <div key={status} style={{ marginBottom: '10px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '5px'
                  }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{status}</span>
                    <span>{count} users</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(count / (stats?.totalUsers || 1)) * 100}%`,
                      height: '100%',
                      backgroundColor: status === 'active' ? '#28a745' : status === 'cancelled' ? '#dc3545' : '#ffc107',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#b5b5b5', padding: '20px' }}>
              No subscription data available
            </div>
          )}
        </div>

        {/* Coin Balance Info */}
        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>Coin Analytics</h4>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7db2ff', marginBottom: '10px' }}>
            {analytics?.averageCoinBalance || 0} coins
          </div>
          <div style={{ fontSize: '14px', color: '#b5b5b5' }}>
            Average coin balance per user
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          backgroundColor: '#1f1f1f',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>Quick Actions</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => handleExport('blogs')}
              disabled={loading}
              style={{
                padding: '10px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Export All Blogs
            </button>
            <button
              onClick={() => handleExport('users')}
              disabled={loading}
              style={{
                padding: '10px 15px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Export User Data
            </button>
            <button
              onClick={() => handleExport('prices')}
              disabled={loading}
              style={{
                padding: '10px 15px',
                backgroundColor: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Export Pricing Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}