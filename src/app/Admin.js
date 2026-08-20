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

  useEffect(() => {
    if (tab !== 'activity') return;
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [tab, load]);

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
        <button className={tab === 'pharmacies' ? 'on' : ''} onClick={() => setTab('pharmacies')}>
          Pharmacies <span>{pharmacies.length}</span>
        </button>
        <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>
          Activity
        </button>
      </div>

      {err && <div className="ia-alert error"><strong>Error.</strong><span>{err}</span></div>}
      {msg && <div className="ia-alert ok"><strong>{msg}</strong></div>}

      {tab === 'health' && <Health app={app} />}

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

      {/* ---------------- activity ---------------- */}
      {tab === 'activity' && (
        <Activity profiles={profiles} pharmacies={pharmacies} onRefresh={load} />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */

function minutesSince(iso) {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function relativeTime(mins) {
  if (mins < 60 * 24) {
    const hours = Math.round(mins / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(mins / (60 * 24));
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function presenceStatus(lastSeenAt) {
  if (!lastSeenAt) return { tag: 'grey', label: 'never signed in' };
  const mins = minutesSince(lastSeenAt);
  if (mins < 5) return { tag: 'green', label: 'active now' };
  if (mins < 60) return { tag: 'amber', label: 'recently' };
  return { tag: 'grey', label: relativeTime(mins) };
}

function Activity({ profiles, pharmacies, onRefresh }) {
  const activeNow = profiles.filter((p) => p.last_seen_at && minutesSince(p.last_seen_at) < 5).length;
  const last24h = profiles.filter((p) => p.last_seen_at && minutesSince(p.last_seen_at) < 60 * 24).length;
  const neverSignedIn = profiles.filter((p) => !p.last_seen_at).length;

  const sorted = [...profiles].sort((a, b) => {
    if (!a.last_seen_at && !b.last_seen_at) return 0;
    if (!a.last_seen_at) return 1;
    if (!b.last_seen_at) return -1;
    return new Date(b.last_seen_at) - new Date(a.last_seen_at);
  });

  return (
    <section className="ia-panel">
      <div className="ia-panel-head">
        <h3>Activity</h3>
        <button className="ia-btn small" onClick={onRefresh}>Refresh</button>
      </div>
      <p className="ia-panel-lead">
        This shows who has had the app open recently, not who is working right now — a
        pharmacist with the tab closed is still on shift. It is not a measure of who is
        "online".
      </p>
      <p className="ia-panel-lead">
        {activeNow} active now &middot; {last24h} in the last 24 hours &middot; {neverSignedIn} never signed in.
      </p>

      <table className="ia-table">
        <thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Pharmacy</th><th>Last active</th></tr></thead>
        <tbody>
          {sorted.map((p) => {
            const status = presenceStatus(p.last_seen_at);
            return (
              <tr key={p.id}>
                <td className="name">{p.full_name || '—'}</td>
                <td>{p.email}</td>
                <td>{p.role}</td>
                <td>{pharmacies.find((x) => x.id === p.pharmacy_id)?.name || '—'}</td>
                <td><span className={'ia-tag ' + status.tag}>{status.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

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
      ok: true,
      warn: c.hpra_total !== c.current,
      value: c.hpra_total === c.current
        ? 'Matches the HPRA count'
        : `We say ${c.current}, HPRA says ${c.hpra_total}`,
      note: c.resolved_note || 'The difference is records carrying a resolution date that the register still returns.',
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
          <F k="Compared against" v={d.meta.compare_label || 'nothing yet'} />
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