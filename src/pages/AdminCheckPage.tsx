import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminCheckPage() {
  const { user, isAdmin, planTier, subscriptionStatus } = useAuth();
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h2>Admin Check</h2>
      <pre style={{ background: '#111', color: '#0f0', padding: 16, borderRadius: 8 }}>
{JSON.stringify({
  email: user?.email || null,
  userId: user?.id || null,
  isAdmin,
  planTier,
  subscriptionStatus,
}, null, 2)}
      </pre>
      <p>Try visiting <a href="/admin">/admin</a> after verifying isAdmin is true.</p>
    </div>
  );
}


