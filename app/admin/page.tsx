

'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BalanceRow = {
  user_id: string;
  balance: number;
};

type AdminRow = {
  role: 'admin' | 'sub_admin';
};

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRow['role'] | null>(null);

  const [users, setUsers] = useState<BalanceRow[]>([]);
  const [amount, setAmount] = useState<string>('1000');
  const [note, setNote] = useState<string>('Admin topup');

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { ok: false as const, role: null as AdminRow['role'] | null };

    const { data, error } = await supabase
      .from('admins')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return { ok: false as const, role: null as AdminRow['role'] | null };

    return { ok: true as const, role: (data as AdminRow).role };
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('balances')
      .select('user_id,balance')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setUsers(
        (data as any[]).map((r) => ({
          user_id: r.user_id,
          balance: Number(r.balance),
        }))
      );
    }
  }

  async function adjustBalance(targetUserId: string, delta: number) {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return alert('Amount must be a positive number');

    const signed = delta > 0 ? v : -v;

    // Read current
    const { data: balRow, error: balErr } = await supabase
      .from('balances')
      .select('balance')
      .eq('user_id', targetUserId)
      .single();

    if (balErr || !balRow) return alert('Cannot read user balance (db)');

    const next = Number((balRow as any).balance) + signed;

    // Update
    const { error: updErr } = await supabase.from('balances').update({ balance: next }).eq('user_id', targetUserId);

    if (updErr) return alert('Update failed (db)');

    // Log topup/deduct
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from('topups').insert({
        user_id: targetUserId,
        admin_id: user.id,
        amount: signed,
        note: note || (signed > 0 ? 'Admin topup' : 'Admin deduct'),
      });
    }

    await loadUsers();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await checkAdmin();
        if (!res.ok) {
          alert('Admin only');
          window.location.href = '/login';
          return;
        }

        setIsAdmin(true);
        setAdminRole(res.role);
        await loadUsers();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0e11', color: 'white', padding: 24 }}>
        <h2>Admin</h2>
        <div style={{ color: '#94a3b8' }}>Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0e11', color: 'white', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Admin Panel</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Role: <b style={{ color: 'white' }}>{adminRole}</b></div>
          <button
            onClick={logout}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #333', background: '#0f0f0f', color: '#cbd5e1' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10, maxWidth: 520 }}>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Top-up / Deduct</div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Amount (USD)</div>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #222',
                  background: '#0f0f0f',
                  color: 'white',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Note</div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #222',
                  background: '#0f0f0f',
                  color: 'white',
                }}
              />
            </div>

            <button
              onClick={loadUsers}
              style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #333', background: '#0f0f0f', color: '#cbd5e1' }}
            >
              Refresh Users
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
            Tip: Choose a user below, then click + / - to adjust.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, background: '#111', border: '1px solid #222', borderRadius: 14, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 900 }}>Users</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{users.length} users</div>
        </div>

        {users.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>No users yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {users.map((u) => (
              <div
                key={u.user_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 10,
                  alignItems: 'center',
                  background: '#0f0f0f',
                  border: '1px solid #222',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{u.user_id.slice(0, 8)}…</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>${money(Number(u.balance))}</div>
                </div>

                <button
                  onClick={() => adjustBalance(u.user_id, +1)}
                  style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #14532d', background: '#16a34a', color: 'white', fontWeight: 900 }}
                >
                  +
                </button>

                <button
                  onClick={() => adjustBalance(u.user_id, -1)}
                  style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #7f1d1d', background: '#ef4444', color: 'white', fontWeight: 900 }}
                >
                  −
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 12 }}>
        Notes: This is a demo admin panel. Balances are shared online in Supabase.
      </div>
    </div>
  );
}