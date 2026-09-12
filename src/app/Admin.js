import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { fmtDate, daysSince } from './useAppData';

/*
  Admin.

  Two jobs. First, create pharmacies and invite people into them, which
  is how Elaine gets an account. No service-role key touches the browser:
  an invite row is created, the person signs up with that email, and a
  database trigger attaches them to the right pharmacy.

  Second, pipeline health. If the collector breaks, the app keeps serving
  yesterday's file and looks completely normal. The only way to notice is
  to check, so this screen checks: how old the data is, whether the counts
  look sane, and whether the reference files loaded.
*/
export default function Admin({ app }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('health');
  const [newCount, setNewCount] = useState(0);

  // Counted here rather than inside the Feedback tab, because a badge
  // that only appears after you open the tab tells you nothing. This is
  // the whole reason the badge exists: to say "someone wrote to you"
  // before you go looking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('feedback')
        .select('id')
        .eq('status', 'new');
      if (!cancelled && !error && data) setNewCount(data.length);
    })();
    return () => { cancelled = true; };
  }, [tab]);
  const [pharmacies, setPharmacies] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [ph, setPh] = useState({ name: '', town: '', county: '' });
  const [inv, setInv] = useState({ email: '', full_name: '', role: 'pharmacist', pharmacy_id: '' });

  const load = useCallback(async () => {
    if (!supabase) return;
    const [a, b, c] = await Promise.all([
      supabase.from('pharmacies').select('*').order('name'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
    ]);
    if (a.error || b.error || c.error) {
      setErr((a.error || b.error || c.error).message);
      return;
    }
    setPharmacies(a.data || []);
    setProfiles(b.data || []);
    setInvites(c.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addPharmacy = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    const { error } = await supabase.from('pharmacies').insert(ph);
    setBusy(false);
    if (error) setErr(error.message);
    else { setMsg(`${ph.name} created.`); setPh({ name: '', town: '', county: '' }); load(); }
  };

  const addInvite = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    const { error } = await supabase.from('invites').insert({
      ...inv,
      email: inv.email.trim().toLowerCase(),
      pharmacy_id: inv.pharmacy_id || null,
      created_by: user?.id || null,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setMsg(`Invite created for ${inv.email}. Ask them to sign up at /login with that exact email address.`);
      setInv({ email: '', full_name: '', role: 'pharmacist', pharmacy_id: '' });
      load();
    }
  };

  const removeInvite = async (id) => {
    await supabase.from('invites').delete().eq('id', id);
    load();
  };

  const setRole = async (id, role) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    load();
  };

  const setPharmacyFor = async (id, pharmacy_id) => {
    await supabase.from('profiles').update({ pharmacy_id: pharmacy_id || null }).eq('id', id);
    load();
  };

  return (
    <>
      <div className="ia-tabs">
        <button className={tab === 'health' ? 'on' : ''} onClick={() => setTab('health')}>Pipeline health</button>
        <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>
          People <span>{profiles.length}</span>
        </button>
        <button className={tab === 'feedback' ? 'on' : ''} onClick={() => setTab('feedback')}>
          Feedback{newCount > 0 && <span className="ia-tab-badge">{newCount}</span>}
        </button>
        <button className={tab === 'pharmacies' ? 'on' : ''} onClick={() => setTab('pharmacies')}>
          Pharmacies <span>{pharmacies.length}</span>
        </button>
      </div>

      {err && <div className="ia-alert error"><strong>Error.</strong><span>{err}</span></div>}
      {msg && <div className="ia-alert ok"><strong>{msg}</strong></div>}

      {tab === 'health' && <Health app={app} />}

      {tab === 'feedback' && <FeedbackAdmin onCount={setNewCount} />}

      {/* ---------------- people ---------------- */}
      {tab === 'people' && (
        <>
          <section className="ia-panel">
            <div className="ia-panel-head"><h3>Invite someone</h3></div>
            <p className="ia-panel-lead">
              Creating an invite does not create an account. It reserves the email address.
              The person then signs up at /login using that exact address and is attached to
              the pharmacy automatically.
            </p>
            <form className="ia-form tight" onSubmit={addInvite}>
              <div className="ia-form-grid">
                <label>Email
                  <input type="email" required value={inv.email}
                    onChange={(e) => setInv((f) => ({ ...f, email: e.target.value }))} />
                </label>
                <label>Name
                  <input value={inv.full_name}
                    onChange={(e) => setInv((f) => ({ ...f, full_name: e.target.value }))} />
                </label>
                <label>Pharmacy
                  <select value={inv.pharmacy_id}
                    onChange={(e) => setInv((f) => ({ ...f, pharmacy_id: e.target.value }))}>
                    <option value="">No pharmacy yet</option>
                    {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label>Role
                  <select value={inv.role}
                    onChange={(e) => setInv((f) => ({ ...f, role: e.target.value }))}>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <div className="ia-form-actions">
                <button className="ia-btn" disabled={busy}>Create invite</button>
              </div>
            </form>

            {invites.length > 0 && (
              <table className="ia-table">
                <thead><tr><th>Email</th><th>Pharmacy</th><th>Role</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td className="name">{i.email}<span className="ia-card-sub">{i.full_name}</span></td>
                      <td>{pharmacies.find((p) => p.id === i.pharmacy_id)?.name || '—'}</td>
                      <td>{i.role}</td>
                      <td>
                        <span className={'ia-tag ' + (i.claimed_at ? 'green' : 'amber')}>
                          {i.claimed_at ? `claimed ${fmtDate(i.claimed_at.slice(0, 10))}` : 'awaiting signup'}
                        </span>
                      </td>
                      <td>{!i.claimed_at && (
                        <button className="ia-linkbtn danger" onClick={() => removeInvite(i.id)}>Remove</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="ia-panel">
            <div className="ia-panel-head"><h3>Accounts</h3></div>
            <table className="ia-table">
              <thead><tr><th>Person</th><th>Pharmacy</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="name">{p.full_name || '—'}<span className="ia-card-sub">{p.email}</span></td>
                    <td>
                      <select value={p.pharmacy_id || ''} onChange={(e) => setPharmacyFor(p.id, e.target.value)}>
                        <option value="">No pharmacy</option>
                        {pharmacies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={p.role} onChange={(e) => setRole(p.id, e.target.value)}>
                        <option value="pharmacist">Pharmacist</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{fmtDate((p.created_at || '').slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* ---------------- pharmacies ---------------- */}
      {tab === 'pharmacies' && (
        <section className="ia-panel">
          <div className="ia-panel-head"><h3>Add a pharmacy</h3></div>
          <form className="ia-form tight" onSubmit={addPharmacy}>
            <div className="ia-form-grid">
              <label>Name
                <input required value={ph.name} onChange={(e) => setPh((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label>Town
                <input value={ph.town} onChange={(e) => setPh((f) => ({ ...f, town: e.target.value }))} />
              </label>
              <label>County
                <input value={ph.county} onChange={(e) => setPh((f) => ({ ...f, county: e.target.value }))} />
              </label>
            </div>
            <div className="ia-form-actions">
              <button className="ia-btn" disabled={busy}>Add pharmacy</button>
            </div>
          </form>

          <table className="ia-table">
            <thead><tr><th>Pharmacy</th><th>Location</th><th>People</th></tr></thead>
            <tbody>
              {pharmacies.map((p) => (
                <tr key={p.id}>
                  <td className="name">{p.name}</td>
                  <td>{[p.town, p.county].filter(Boolean).join(', ') || '—'}</td>
                  <td>{profiles.filter((x) => x.pharmacy_id === p.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */

function Health({ app }) {
  if (!app.ready) {
    return (
      <div className="ia-alert error">
        <strong>The register file is not loading.</strong>
        <span>
          {app.error || 'Still loading.'} Every pharmacy screen is empty right now. Check that
          the workflow ran and that insova-app.json is in the website repo's public folder.
        </span>
      </div>
    );
  }

  const d = app.data;
  const age = daysSince(d.meta.as_of);
  const c = d.counts;

  const checks = [
    {
      name: 'Data freshness',
      ok: age <= 1,
      warn: age === 2 || age === 3,
      value: age === 0 ? 'Collected today' : `${age} day${age === 1 ? '' : 's'} old`,
      note: 'The register is collected each morning. Anything over a day old on a weekday means the workflow did not run.',
    },
    {
      name: 'Product count',
      ok: c.current > 200 && c.current < 800,
      value: `${c.current} current shortages`,
      note: 'Has sat between roughly 350 and 400. A sudden collapse usually means the collector returned a partial page.',
    },
    {
      name: 'HPRA reconciliation',
      ok: c.hpra_total === c.current,
      warn: c.hpra_total !== c.current,
      value: c.hpra_total === c.current
        ? `Matches the HPRA count of ${c.hpra_total}`
        : `We say ${c.current}, HPRA says ${c.hpra_total}`,
      note: c.hpra_total === c.current
        ? 'Our count and the regulator\'s agree. If they ever diverge, assume the fault is ours until shown otherwise: it was last time.'
        : (c.resolved_note || 'Our count differs from the HPRA\'s. Check the collector before quoting either number.'),
    },
    {
      name: 'Interchangeable list',
      ok: c.groups_affected > 0,
      value: c.groups_affected
        ? `${c.groups_affected} groups matched`
        : 'No groups matched — reference file missing?',
      note: 'If this is zero, interchangeables.csv did not load and every product will show as not on the IC list.',
    },
    {
      name: 'Supply notices',
      ok: true,
      value: `${c.notices} shortages carry a notice`,
      note: 'A number that climbs every single day suggests letters.py is treating regenerated URLs as new documents again.',
    },
    {
      name: 'HPRA update date',
      ok: Boolean(d.meta.hpra_last_updated),
      warn: !d.meta.hpra_last_updated,
      value: d.meta.hpra_last_updated
        ? `HPRA says ${d.meta.hpra_last_updated}`
        : 'not recorded',
      note: d.meta.hpra_last_updated
        ? 'Read from the HPRA page itself. Everything about what changed is measured against this rather than against our own snapshots differing.'
        : 'The collector could not read "List last updated" from the page. Change detection falls back to comparing snapshots, which cannot tell a real change from a record being renumbered.',
    },
    {
      name: 'Archive depth',
      ok: d.meta.days_archived >= 7,
      warn: d.meta.days_archived < 7,
      value: `${d.meta.days_archived} days from ${fmtDate(d.meta.first_archived)}`,
      note: 'The archive is the asset. Every missed morning is a gap that cannot be filled later.',
    },
  ];

  return (
    <>
      <p className="ia-lead">
        If the collector breaks, the app keeps serving the last good file and looks completely
        normal. These are the checks that would tell you otherwise.
      </p>

      <div className="ia-checks">
        {checks.map((ch) => (
          <div key={ch.name} className={'ia-check ' + (ch.ok && !ch.warn ? 'ok' : ch.warn ? 'warn' : 'bad')}>
            <div className="ia-check-top">
              <span className="ia-check-dot" aria-hidden="true" />
              <strong>{ch.name}</strong>
              <span className="ia-check-value">{ch.value}</span>
            </div>
            <p>{ch.note}</p>
          </div>
        ))}
      </div>

      <section className="ia-panel">
        <div className="ia-panel-head"><h3>Today's export</h3></div>
        <div className="ia-facts">
          <F k="Collected" v={d.meta.as_of_label} />
          <F k="Generated" v={(d.meta.generated_at || '').replace('T', ' ').slice(0, 19)} />
          <F k="Schema" v={d.meta.schema} />
          <F k="HPRA last updated the list"
             v={d.meta.hpra_last_updated || 'not recorded (pre-v0.8 snapshot)'} />
          <F k="Compared against our snapshot of" v={d.meta.compare_label || 'nothing yet'} />
          <F k="Renumbered by the HPRA" v={String(d.meta.renumbered ?? 0)} />
          <F k="Quiet mornings skipped" v={String(d.meta.quiet_mornings)} />
          <F k="Changes found" v={String((d.changes || []).length)} />
          <F k="Groups down to one" v={String(c.groups_last_product)} />
          <F k="Groups exhausted" v={String(c.groups_exhausted)} />
          <F k="Not on the IC list" v={`${c.no_interchangeable} of ${c.current}`} />
          <F k="No alternative authorised" v={String(c.no_alternative_authorised)} />
          <F k="Announced, not started" v={String(c.not_started)} />
          <F k="Past return date" v={String(c.past_return_date)} />
          <F k="Over a year" v={String(c.over_one_year)} />
          <F k="High supply risk" v={String(c.high_risk)} />
        </div>
      </section>
    </>
  );
}

function F({ k, v }) {
  return <div className="ia-fact"><span className="k">{k}</span><span className="v">{v}</span></div>;
}


/* ---------------------------------------------------------------------
   Feedback triage.

   Read-only on the words. An admin can change the status and attach a
   reply, and that reply is shown back to the person who wrote it, but
   the message itself cannot be edited: a database trigger refuses, and
   so does this screen. Feedback you can rewrite is not feedback.
   --------------------------------------------------------------------- */
function FeedbackAdmin({ onCount }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('new');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (e) setError(e.message);
    else {
      setRows(data || []);
      onCount((data || []).filter((r) => r.status === 'new').length);
    }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status, note) => {
    const patch = { status };
    if (note !== undefined) patch.admin_note = note || null;
    if (status !== 'new') patch.handled_at = new Date().toISOString();
    const { error: e } = await supabase.from('feedback').update(patch).eq('id', id);
    if (e) setError(e.message);
    setReplyTo(null);
    setReplyText('');
    load();
  };

  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const counts = {
    new: rows.filter((r) => r.status === 'new').length,
    read: rows.filter((r) => r.status === 'read').length,
    actioned: rows.filter((r) => r.status === 'actioned').length,
  };

  const CAT = {
    wrong: ['A number looks wrong', 'red'],
    broken: ['Something is broken', 'amber'],
    idea: ['Something is missing', 'green'],
    other: ['Something else', 'grey'],
  };

  return (
    <>
      <p className="ia-lead">
        Everything pharmacists have sent. Anything marked <b>a number looks
        wrong</b> should be checked against the HPRA the same day: if our
        figure disagrees with theirs, ours is the one to fix.
      </p>

      {error && <div className="ia-alert error"><span>{error}</span></div>}

      <div className="ia-filters">
        {[['new', `New (${counts.new})`], ['read', `Read (${counts.read})`],
          ['actioned', `Acted on (${counts.actioned})`], ['all', `All (${rows.length})`]]
          .map(([v, l]) => (
            <button key={v}
              className={'ia-chip' + (filter === v ? ' on' : '')}
              onClick={() => setFilter(v)}>{l}</button>
          ))}
      </div>

      {loading ? (
        <p className="ia-empty">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="ia-empty">
          {filter === 'new'
            ? 'Nothing new. That is either good or it means nobody is using it.'
            : 'Nothing here.'}
        </p>
      ) : (
        <div className="ia-fb-admin">
          {shown.map((f) => {
            const [label, tone] = CAT[f.category] || [f.category, 'grey'];
            return (
              <article key={f.id} className={'ia-fb-admin-item ' + f.status}>
                <div className="ia-fb-admin-top">
                  <span className={'ia-tag ' + tone}>{label}</span>
                  <span className="ia-fb-admin-meta">
                    {fmtDate(f.created_at)}
                    {f.screen && ` · on ${f.screen}`}
                    {f.data_date && ` · reading the register of ${fmtDate(f.data_date)}`}
                  </span>
                </div>

                <p className="ia-fb-admin-msg">{f.message}</p>

                {f.admin_note && (
                  <p className="ia-fb-item-reply">
                    <strong>Replied:</strong> {f.admin_note}
                  </p>
                )}

                {replyTo === f.id ? (
                  <div className="ia-fb-admin-reply">
                    <textarea
                      rows={3}
                      value={replyText}
                      placeholder="This is shown back to the person who sent it."
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="ia-fb-admin-actions">
                      <button className="ia-btn small"
                        onClick={() => setStatus(f.id, 'actioned', replyText)}>
                        Save and mark acted on
                      </button>
                      <button className="ia-linkbtn" onClick={() => setReplyTo(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ia-fb-admin-actions">
                    {f.status === 'new' && (
                      <button className="ia-linkbtn" onClick={() => setStatus(f.id, 'read')}>
                        Mark read
                      </button>
                    )}
                    <button className="ia-linkbtn"
                      onClick={() => { setReplyTo(f.id); setReplyText(f.admin_note || ''); }}>
                      {f.admin_note ? 'Edit reply' : 'Reply'}
                    </button>
                    {f.status !== 'closed' && (
                      <button className="ia-linkbtn" onClick={() => setStatus(f.id, 'closed')}>
                        Close
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}