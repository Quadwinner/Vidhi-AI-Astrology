import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface DailyAnalyticsRow {
  day: string;
  new_users: number;
  returning_users: number;
  total_orders: number;
  total_payment: number;
  total_subscriptions: number;
  payment_failed: number;
  total_chats: number;
  total_calls: number;
  total_reports: number;
  questions_used: number;
  talk_minutes_used: number;
  whatsapp_clicks: number;
  total_llm_cost_inr: number;
  avg_llm_cost_per_chat_inr: number;
}

export default function DailyAnalytics() {
  const [data, setData] = useState<DailyAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: analyticsData, error: fetchError } = await supabase.functions.invoke(
        'get-daily-analytics',
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (fetchError) {
        throw fetchError;
      }

      setData(analyticsData.data || []);
    } catch (err: any) {
      console.error('Error loading daily analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading daily analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#ff4444', marginBottom: '20px' }}>
          Error: {error}
        </div>
        <button
          onClick={loadAnalytics}
          style={{
            padding: '10px 20px',
            backgroundColor: '#667eea',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      new_users: acc.new_users + Number(row.new_users || 0),
      returning_users: acc.returning_users + Number(row.returning_users || 0),
      total_orders: acc.total_orders + Number(row.total_orders || 0),
      total_payment: acc.total_payment + Number(row.total_payment || 0),
      total_subscriptions: acc.total_subscriptions + Number(row.total_subscriptions || 0),
      payment_failed: acc.payment_failed + Number(row.payment_failed || 0),
      total_chats: acc.total_chats + Number(row.total_chats || 0),
      total_calls: acc.total_calls + Number(row.total_calls || 0),
      total_reports: acc.total_reports + Number(row.total_reports || 0),
      questions_used: acc.questions_used + Number(row.questions_used || 0),
      talk_minutes_used: acc.talk_minutes_used + Number(row.talk_minutes_used || 0),
      whatsapp_clicks: acc.whatsapp_clicks + Number(row.whatsapp_clicks || 0),
      total_llm_cost_inr: acc.total_llm_cost_inr + Number(row.total_llm_cost_inr || 0),
    }),
    {
      new_users: 0,
      returning_users: 0,
      total_orders: 0,
      total_payment: 0,
      total_subscriptions: 0,
      payment_failed: 0,
      total_chats: 0,
      total_calls: 0,
      total_reports: 0,
      questions_used: 0,
      talk_minutes_used: 0,
      whatsapp_clicks: 0,
      total_llm_cost_inr: 0,
    }
  );

  return (
    <div style={{ padding: '20px', color: '#eaeaea' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#ffffff' }}>Daily Analytics (Last 30 Days)</h3>
        <button
          onClick={loadAnalytics}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2e7d32',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '30px',
        }}
      >
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Total New Users</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#7db2ff' }}>
            {totals.new_users.toLocaleString()}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Total Revenue</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#57d57a' }}>
            ₹{totals.total_payment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Total Orders</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffcf5a' }}>
            {totals.total_orders.toLocaleString()}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Total Chats</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fe6c0f' }}>
            {totals.total_chats.toLocaleString()}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Total Calls</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff5252' }}>
            {totals.total_calls.toLocaleString()}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={cardTitleStyle}>LLM Cost (INR)</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff9800' }}>
            ₹{totals.total_llm_cost_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div
        style={{
          backgroundColor: '#1f1f1f',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid #2a2a2a',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#161616' }}>
                <th style={headerStyle}>Date</th>
                <th style={headerStyle}>New Users</th>
                <th style={headerStyle}>Returning</th>
                <th style={headerStyle}>Orders</th>
                <th style={headerStyle}>Revenue (₹)</th>
                <th style={headerStyle}>Subscriptions</th>
                <th style={headerStyle}>Failed</th>
                <th style={headerStyle}>Chats</th>
                <th style={headerStyle}>Calls</th>
                <th style={headerStyle}>Reports</th>
                <th style={headerStyle}>Questions</th>
                <th style={headerStyle}>Talk Mins</th>
                <th style={headerStyle}>WhatsApp</th>
                <th style={headerStyle}>LLM Cost</th>
                <th style={headerStyle}>Avg/Chat</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr
                  key={index}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#1f1f1f',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                >
                  <td style={cellStyle}>{new Date(row.day).toLocaleDateString()}</td>
                  <td style={cellStyle}>{Number(row.new_users || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.returning_users || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.total_orders || 0).toLocaleString()}</td>
                  <td style={cellStyle}>
                    ₹{Number(row.total_payment || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={cellStyle}>{Number(row.total_subscriptions || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.payment_failed || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.total_chats || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.total_calls || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.total_reports || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.questions_used || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.talk_minutes_used || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{Number(row.whatsapp_clicks || 0).toLocaleString()}</td>
                  <td style={cellStyle}>
                    ₹{Number(row.total_llm_cost_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={cellStyle}>
                    ₹{Number(row.avg_llm_cost_per_chat_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 6 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#1f1f1f',
  padding: '20px',
  borderRadius: '10px',
  border: '1px solid #2a2a2a',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#cfcfcf',
  marginBottom: '10px',
};

const headerStyle: React.CSSProperties = {
  padding: '15px 10px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#cfcfcf',
  whiteSpace: 'nowrap',
};

const cellStyle: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: '13px',
  color: '#eaeaea',
  whiteSpace: 'nowrap',
};
