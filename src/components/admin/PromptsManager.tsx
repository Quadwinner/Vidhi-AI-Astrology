import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Prompt {
  id: number;
  name?: string;
  prompt_name?: string;
  content?: string;
  prompt?: string;
  model?: string | null;
  model_name?: string | null;
  is_active?: boolean;
  active?: boolean;
  description?: string | null;
  prompt_text?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function PromptsManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [form, setForm] = useState({ name: '', content: '', model: '', description: '', is_active: false });

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('system_prompts').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      setPrompts((data as any[] | null) || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to fetch prompts');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPrompts(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const name = (form.name || '').trim();
      const content = (form.content || '').trim();
      const model = (form.model || '').trim();
      const description = (form.description || '').trim();
      if (!name) { toast.error('Name is required'); setLoading(false); return; }
      if (!content) { toast.error('Content is required'); setLoading(false); return; }
      const payload: any = { name, content, model, description, is_active: form.is_active, updated_at: new Date().toISOString() };
      // Backward-compat fields if legacy columns exist
      payload.prompt_name = name;
      payload.prompt = content;
      payload.prompt_text = content;
      payload.model_name = model;

      if (editing) {
        const { error } = await supabase.from('system_prompts').update(payload).eq('id', editing.id);
        if (error) throw error; toast.success('Prompt updated');
      } else {
        const { error } = await supabase.from('system_prompts').insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error; toast.success('Prompt created');
      }
      setEditing(null); setShowForm(false); setForm({ name: '', content: '', model: '', description: '', is_active: false });
      fetchPrompts();
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Save failed'); } finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    if (!(window as any).confirm('Delete this prompt?')) return;
    try {
      const { error } = await supabase.from('system_prompts').delete().eq('id', id);
      if (error) throw error; toast.success('Prompt deleted'); fetchPrompts();
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Delete failed'); }
  };

  const toggleActive = async (p: Prompt) => {
    try {
      const nextActive = !Boolean(p.is_active);
      // If activating, first deactivate any other active prompt with the same name
      if (nextActive) {
        const candidateName = (p.name || p.prompt_name || '').trim();
        if (candidateName) {
          // Try legacy column first (prompt_name), then fallback to name
          let deactivateErr: any = null;
          try {
            const { error: e1 } = await supabase
              .from('system_prompts')
              .update({ is_active: false })
              .eq('prompt_name', candidateName)
              .neq('id', p.id);
            if (e1) deactivateErr = e1;
          } catch (e: any) { deactivateErr = e; }

          if (deactivateErr) {
            // Fallback to name column if prompt_name doesn't exist
            try {
              await supabase
                .from('system_prompts')
                .update({ is_active: false })
                .eq('name', candidateName)
                .neq('id', p.id);
            } catch (_ignored) {}
          }
        }
      }

      const { error } = await supabase
        .from('system_prompts')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', p.id);
      if (error) throw error;
      fetchPrompts();
    } catch (e: any) { toast.error(e?.message || 'Update failed'); }
  };

  return (
    <div style={{ padding: 20, color: '#eaeaea' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#fff' }}>System Prompts</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchPrompts} style={{ padding: '8px 12px', background: '#117a8b', color: '#fff', border: 'none', borderRadius: 6 }}>Refresh</button>
          <button onClick={() => { setEditing(null); setForm({ name: '', content: '', model: '', description: '', is_active: false }); setShowForm(true); }} style={{ padding: '8px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6 }}>New Prompt</button>
        </div>
      </div>

      <div style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#161616', color: '#cfcfcf' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 12 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 12 }}>Model</th>
              <th style={{ textAlign: 'left', padding: 12 }}>Description</th>
              <th style={{ textAlign: 'left', padding: 12 }}>Active</th>
              <th style={{ textAlign: 'left', padding: 12 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: 12, color: '#fff' }}>{p.name || p.prompt_name || '(unnamed)'}</td>
                <td style={{ padding: 12 }}>{p.model || p.model_name || '-'}</td>
                <td style={{ padding: 12, color: '#cfcfcf', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.description || '') || '-'}</td>
                <td style={{ padding: 12 }}>
                  {(() => { const active = Boolean(p.is_active); return (
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: active ? '#154a27' : '#4a1b1b', color: active ? '#9ee6b1' : '#f1aeb5' }}>{active ? 'Yes' : 'No'}</span>
                  ); })()}
                </td>
                <td style={{ padding: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => toggleActive(p)} style={{ padding: '6px 10px', background: '#ffc107', color: '#212529', border: 'none', borderRadius: 6 }}>{Boolean(p.is_active) ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => { setEditing(p); setForm({ name: (p.name || p.prompt_name || ''), content: (p.content || p.prompt || p.prompt_text || ''), model: (p.model || p.model_name || ''), description: (p.description || ''), is_active: (p.is_active ?? p.active ?? false) }); setShowForm(true); }} style={{ padding: '6px 10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6 }}>Edit</button>
                    <button onClick={() => remove(p.id)} style={{ padding: '6px 10px', background: '#b02a37', color: '#fff', border: 'none', borderRadius: 6 }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && prompts.length === 0 && <div style={{ padding: 24, color: '#b5b5b5', textAlign: 'center' }}>No prompts yet.</div>}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 10, padding: 24, width: '90%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
            <h4 style={{ marginTop: 0, color: '#fff' }}>{editing ? 'Edit Prompt' : 'Create Prompt'}</h4>
            <form onSubmit={submit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #444', background: '#111', color: '#eaeaea' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Model (optional)</label>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #444', background: '#111', color: '#eaeaea' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Description (optional)</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #444', background: '#111', color: '#eaeaea' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Content</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required rows={10} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #444', background: '#111', color: '#eaeaea', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <span>Active</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={loading} style={{ padding: '8px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 6 }}>{loading ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} style={{ padding: '8px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


