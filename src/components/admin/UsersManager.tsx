import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface DbUser {
  id: string;
  email?: string;
  plan_tier?: string | null;
  subscription_status?: string | null;
  coin_balance?: number | null;
  wallet_balance?: number | null;
  currency_code?: string | null;
  is_admin?: boolean | null;
}

const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', AED: 'د.إ', EUR: '€', GBP: '£' };

export default function UsersManager() {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.email || '').toLowerCase().includes(q));
  }, [users, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, plan_tier, subscription_status, coin_balance, wallet_balance, currency_code, is_admin')
        .order('email', { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (e: any) {
      console.error('Fetch users failed', e);
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to load users';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleAdmin = async (user: DbUser) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: !user.is_admin })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${user.email || 'User'} ${!user.is_admin ? 'granted' : 'revoked'} admin`);
      fetchUsers();
    } catch (e: any) {
      console.error('Toggle admin failed', e);
      toast.error('Failed to update admin flag');
    }
  };

  return (
    <div style={{ padding: 20, color: '#eaeaea' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#ffffff' }}>User Management</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email"
            style={{ padding: 8, borderRadius: 6, border: '1px solid #2a2a2a', background: '#111', color: '#eaeaea' }}
          />
          <button onClick={fetchUsers} style={{ padding: '8px 12px', background: '#117a8b', color: '#fff', border: 'none', borderRadius: 6 }}>Refresh</button>
        </div>
      </div>

      <div style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#161616', color: '#cfcfcf' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #2a2a2a' }}>Email</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #2a2a2a' }}>Plan</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #2a2a2a' }}>Sub Status</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #2a2a2a' }}>Wallet Balance</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #2a2a2a' }}>Admin</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #2a2a2a' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: 12, color: '#ffffff' }}>{u.email}</td>
                <td style={{ padding: 12 }}>{u.plan_tier || 'free'}</td>
                <td style={{ padding: 12 }}>{u.subscription_status || 'none'}</td>
                <td style={{ padding: 12 }}>
                  {(CURRENCY_SYMBOL[u.currency_code || ''] || '')}
                  {((u.wallet_balance ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: 12 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: 12,
                    background: u.is_admin ? '#154a27' : '#4a1b1b', color: u.is_admin ? '#9ee6b1' : '#f1aeb5'
                  }}>{u.is_admin ? 'Yes' : 'No'}</span>
                </td>
                <td style={{ padding: 12 }}>
                  <button onClick={() => toggleAdmin(u)} style={{ padding: '6px 10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6 }}>
                    {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, color: '#b5b5b5', textAlign: 'center' }}>No users found.</div>
        )}
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#b5b5b5' }}>Loading users...</div>
      )}
    </div>
  );
}


