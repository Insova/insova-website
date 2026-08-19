import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { fmtDate } from './useAppData';

/*
  Unlicensed medicines.

  When a medicine is short and nothing on the HPRA interchangeable list
  covers it, a pharmacy may have to source an unlicensed medicine. Those
  are on no list, and whether the PCRS reimburses a given one is not
  published anywhere. Every pharmacy works it out alone and then forgets.

  This screen is deliberately a REIMBURSEMENT RECORD, not a substitution
  recommendation. It captures what was supplied and whether it was paid
  for. It never tells a pharmacist what to supply, and the shared view
  is labelled as other pharmacies' experience rather than as advice.
*/

const REIMBURSED = [
  ['pending', 'Awaiting decision'],
  ['yes', 'Reimbursed'],
  ['partial', 'Partly reimbursed'],
  ['no', 'Not reimbursed'],
  ['unknown', 'Never found out'],
];

const EMPTY = {
  short_product: '',
  short_substance: '',
  ulm_name: '',
  ulm_supplier: '',
  ulm_country: '',
  strength_form: '',
  supplied_on: '',
  reimbursed: 'pending',
  reimbursed_note: '',
  price_paid: '',
  note: '',
};

export default function ULM({ app }) {
  const { pharmacy, user, isAdmin } = useAuth();
  const [tab, setTab] = useState('mine');
  const [mine, setMine] = useState([]);
  const [shared, setShared] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !pharmacy?.id) return;
    // Read across the pharmacy: a colleague's record of what was
    // supplied is exactly what the next person facing the same gap
    // needs. Writing is restricted to the author, enforced in the
    // database and mirrored in the buttons below.
    //
    // The pharmacy filter is explicit as well as enforced by row level
    // security. RLS is the boundary; this is the second lock.
    const { data: rows, error } = await supabase
      .from('ulm_records')
      .select('*')
      .eq('pharmacy_id', pharmacy.id)
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    else setMine(rows || []);

    const { data: sh } = await supabase
      .from('ulm_shared')
      .select('*')
      .order('supplied_on', { ascending: false })
      .limit(400);
    setShared(sh || []);
  }, [pharmacy]);

  useEffect(() => { load(); }, [load]);

  // Products with no interchangeable listing are exactly the ones that
  // end up needing an unlicensed medicine, so offer them as suggestions.
  const noIcProducts = useMemo(() => {
    if (!app.ready) return [];
    return app.data.items
      .filter((i) => !i.group)
      .map((i) => ({ product: i.product, substance: i.substances[0] || '' }))
      .sort((a, b) => a.product.localeCompare(b.product));
  }, [app]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!pharmacy?.id) { setErr('Your account is not linked to a pharmacy.'); return; }
    setBusy(true);
    const payload = {
      ...form,
      pharmacy_id: pharmacy.id,
      created_by: user.id,
      price_paid: form.price_paid === '' ? null : Number(form.price_paid),
      supplied_on: form.supplied_on || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('ulm_records')
        .update(payload).eq('id', editing).eq('created_by', user.id));
    } else {
      ({ error } = await supabase.from('ulm_records').insert(payload));
    }
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(editing ? 'Record updated.' : 'Record saved.');
    setForm(EMPTY); setEditing(null);
    load();
  };

  const edit = (r) => {
    if (r.created_by !== user?.id) {
      setErr('That record was made by a colleague. Only its author can edit it.');
      return;
    }
    setEditing(r.id);
    setForm({
      short_product: r.short_product || '',
      short_substance: r.short_substance || '',
      ulm_name: r.ulm_name || '',
      ulm_supplier: r.ulm_supplier || '',
      ulm_country: r.ulm_country || '',
      strength_form: r.strength_form || '',
      supplied_on: r.supplied_on || '',
      reimbursed: r.reimbursed || 'pending',
      reimbursed_note: r.reimbursed_note || '',
      price_paid: r.price_paid ?? '',
      note: r.note || '',
    });
    setTab('add');
    window.scrollTo(0, 0);
  };

  const remove = async (id) => {
    const row = mine.find((r) => r.id === id);
    if (!row) return;
    const ownIt = row.created_by === user?.id;
    if (!ownIt && !isAdmin) {
      setErr('That record was made by a colleague. Only its author or an admin can delete it.');
      return;
    }
    if (!window.confirm(ownIt
      ? 'Delete this record?'
      : 'This record was made by a colleague. Delete it as an administrator?')) return;
    const { error } = await supabase.from('ulm_records').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const sharedFiltered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return shared;
    return shared.filter((r) =>
      [r.short_substance, r.short_product, r.ulm_name, r.ulm_supplier]
        .join(' ').toLowerCase().includes(t));
  }, [shared, q]);

  return (
    <>
      <p className="ia-lead">
        When a medicine is short and nothing on the HPRA interchangeable list covers it, the
        only route left is often an unlicensed medicine. Those are on no list, and whether the
        PCRS reimburses one is not published anywhere. Every pharmacy works that out alone.
        This is the shared record of what actually happened.
      </p>

      <div className="ia-callout">
        <strong>This is a reimbursement record, not a recommendation.</strong>
        <p>
          What another pharmacy supplied and whether it was paid for is useful to know. It is
          not advice about what you should supply. That decision is yours, with the prescriber.
        </p>
      </div>

      <div className="ia-tabs">
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          {pharmacy?.name || 'This pharmacy'} <span>{mine.length}</span>
        </button>
        <button className={tab === 'shared' ? 'on' : ''} onClick={() => setTab('shared')}>
          What others recorded <span>{shared.length}</span>
        </button>
        <button className={tab === 'add' ? 'on' : ''} onClick={() => { setTab('add'); setEditing(null); setForm(EMPTY); }}>
          {editing ? 'Edit record' : 'Add a record'}
        </button>
      </div>

      {err && <div className="ia-alert error"><strong>Could not save.</strong><span>{err}</span></div>}
      {msg && <div className="ia-alert ok"><strong>{msg}</strong></div>}

      {/* ---------------- add / edit ---------------- */}
      {tab === 'add' && (
        <form className="ia-form" onSubmit={submit}>
          <fieldset>
            <legend>The medicine that was short</legend>
            <div className="ia-form-grid">
              <label>
                Product
                <input
                  list="ia-noic"
                  value={form.short_product}
                  onChange={(e) => {
                    const v = e.target.value;
                    const hit = noIcProducts.find((p) => p.product === v);
                    setForm((f) => ({
                      ...f,
                      short_product: v,
                      short_substance: hit?.substance || f.short_substance,
                    }));
                  }}
                  required
                />
                <span className="hint">Products with no interchangeable listing are suggested</span>
              </label>
              <datalist id="ia-noic">
                {noIcProducts.slice(0, 400).map((p) => (
                  <option key={p.product} value={p.product} />
                ))}
              </datalist>
              <label>
                Active substance
                <input
                  value={form.short_substance}
                  onChange={(e) => setForm((f) => ({ ...f, short_substance: e.target.value }))}
                />
                <span className="hint">This is what makes the record findable by others</span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>What was supplied instead</legend>
            <div className="ia-form-grid">
              <label>
                Unlicensed medicine
                <input value={form.ulm_name}
                  onChange={(e) => setForm((f) => ({ ...f, ulm_name: e.target.value }))} required />
              </label>
              <label>
                Strength and form
                <input value={form.strength_form}
                  onChange={(e) => setForm((f) => ({ ...f, strength_form: e.target.value }))} />
              </label>
              <label>
                Supplier
                <input value={form.ulm_supplier}
                  onChange={(e) => setForm((f) => ({ ...f, ulm_supplier: e.target.value }))} />
              </label>
              <label>
                Country of origin
                <input value={form.ulm_country}
                  onChange={(e) => setForm((f) => ({ ...f, ulm_country: e.target.value }))} />
              </label>
              <label>
                Date supplied
                <input type="date" value={form.supplied_on}
                  onChange={(e) => setForm((f) => ({ ...f, supplied_on: e.target.value }))} />
              </label>
              <label>
                Price paid (€)
                <input type="number" step="0.01" min="0" value={form.price_paid}
                  onChange={(e) => setForm((f) => ({ ...f, price_paid: e.target.value }))} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Reimbursement</legend>
            <div className="ia-form-grid">
              <label>
                Did the PCRS reimburse it?
                <select value={form.reimbursed}
                  onChange={(e) => setForm((f) => ({ ...f, reimbursed: e.target.value }))}>
                  {REIMBURSED.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className="hint">Come back and update this when you find out</span>
              </label>
              <label>
                Anything worth knowing about the claim
                <input value={form.reimbursed_note}
                  onChange={(e) => setForm((f) => ({ ...f, reimbursed_note: e.target.value }))} />
              </label>
            </div>
            <label className="wide">
              Notes
              <textarea rows={3} value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
          </fieldset>

          <div className="ia-form-actions">
            <button className="ia-btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update record' : 'Save record'}
            </button>
            {editing && (
              <button type="button" className="ia-linkbtn"
                onClick={() => { setEditing(null); setForm(EMPTY); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* ---------------- our records ---------------- */}
      {tab === 'mine' && (
        mine.length === 0 ? (
          <p className="ia-empty">
            Nothing recorded yet. The next time a shortage forces you to an unlicensed
            medicine, add it here, and update it when the PCRS decides.
          </p>
        ) : (
          <div className="ia-cards">
            {mine.map((r) => (
              <article key={r.id} className="ia-ulm">
                <div className="ia-ulm-head">
                  <div>
                    <strong>{r.short_product}</strong>
                    <span className="ia-card-sub">{r.short_substance}</span>
                  </div>
                  <span className={'ia-tag ' + reimbursedTone(r.reimbursed)}>
                    {label(r.reimbursed)}
                  </span>
                </div>
                <div className="ia-ulm-body">
                  <div className="ia-fact"><span className="k">Supplied instead</span>
                    <span className="v">{r.ulm_name}{r.strength_form ? ` · ${r.strength_form}` : ''}</span></div>
                  {r.ulm_supplier && <div className="ia-fact"><span className="k">Supplier</span>
                    <span className="v">{r.ulm_supplier}{r.ulm_country ? ` (${r.ulm_country})` : ''}</span></div>}
                  {r.supplied_on && <div className="ia-fact"><span className="k">Date</span>
                    <span className="v">{fmtDate(r.supplied_on)}</span></div>}
                  {r.price_paid != null && <div className="ia-fact"><span className="k">Price</span>
                    <span className="v">€{Number(r.price_paid).toFixed(2)}</span></div>}
                  {r.reimbursed_note && <div className="ia-fact"><span className="k">Claim note</span>
                    <span className="v">{r.reimbursed_note}</span></div>}
                  {r.note && <p className="ia-ulm-note">{r.note}</p>}
                </div>
                <div className="ia-ulm-actions">
                  {r.created_by === user?.id ? (
                    <>
                      <button className="ia-linkbtn" onClick={() => edit(r)}>Edit</button>
                      <button className="ia-linkbtn danger" onClick={() => remove(r.id)}>Delete</button>
                    </>
                  ) : (
                    <>
                      <span className="ia-ulm-owner">Recorded by a colleague</span>
                      {isAdmin && (
                        <button className="ia-linkbtn danger" onClick={() => remove(r.id)}>
                          Delete as admin
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* ---------------- shared ---------------- */}
      {tab === 'shared' && (
        <>
          <p className="ia-panel-lead">
            What other pharmacies using Insova have recorded. Pharmacy names are not shown.
            Treat this as experience, not as guidance.
          </p>
          <input className="ia-search" type="search" placeholder="Search by substance or medicine…"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search shared records" />
          {sharedFiltered.length === 0 ? (
            <p className="ia-empty">
              {q ? 'Nothing matches.' : 'Nothing has been recorded across the network yet. Yours would be the first.'}
            </p>
          ) : (
            <table className="ia-table">
              <thead>
                <tr>
                  <th>Substance short</th><th>Unlicensed medicine used</th>
                  <th>Supplier</th><th>Reimbursed</th><th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {sharedFiltered.map((r, x) => (
                  <tr key={x}>
                    <td className="name">{r.short_substance}<span className="ia-card-sub">{r.short_product}</span></td>
                    <td>{r.ulm_name}<span className="ia-card-sub">{r.strength_form}</span></td>
                    <td>{r.ulm_supplier}{r.ulm_country ? ` (${r.ulm_country})` : ''}</td>
                    <td><span className={'ia-tag ' + reimbursedTone(r.reimbursed)}>{label(r.reimbursed)}</span></td>
                    <td>{r.times_recorded > 1 ? `${r.times_recorded} times` : 'once'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <p className="ia-source">
        Records are visible to everyone at {pharmacy?.name || 'your pharmacy'}, because the next
        colleague to face the same gap needs to see what you found. Only the person who made a
        record can edit it. What others recorded is de-identified across all pharmacies and
        carries no names.
      </p>
    </>
  );
}

function label(v) {
  const hit = REIMBURSED.find(([k]) => k === v);
  return hit ? hit[1] : v;
}

function reimbursedTone(v) {
  if (v === 'yes') return 'green';
  if (v === 'no') return 'red';
  if (v === 'partial') return 'amber';
  return 'grey';
}