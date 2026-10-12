import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

/*
  Notices.

  Top: short summaries of the supply notices, written by AI from the
  document, checked against it in code, and approved by a pharmacist
  before they appear here. Below: every notice, as before, linking to
  the original on hpra.ie.

  WHERE THE SUMMARIES COME FROM
  summarise_notices.py in insova-data, every morning after letters.py.
  Only rows with status 'approved' are readable by pharmacists (RLS in
  notice_summaries.sql), so nothing unreviewed can reach this screen.

  WHAT WE STILL DO NOT DO
  We do not show a date for any letter. Dates appear only inside a point
  where the notice itself states one, and every point can be expanded to
  show the wording it came from.
*/

// Same normalisation as letters.py and summarise_notices.py.
const titleKey = (t) =>
  String(t || '').replace(/\s+/g, ' ').trim().toLowerCase() || 'hcp letter';

const SECTIONS = [
  ['affected', "What's affected"],
  ['changed', "What's changed"],
  ['actions', 'What to do'],
];

export default function Notices({ app }) {
  const { data } = app;
  const [q, setQ] = useState('');
  const [sums, setSums] = useState(null); // null = loading
  const [sumErr, setSumErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setSums([]); return; }
      const { data: rows, error } = await supabase
        .from('notice_summaries')
        .select('shortage_id,title_key,document_url,summary')
        .eq('status', 'approved');
      if (cancelled) return;
      if (error) { setSumErr(error.message); setSums([]); }
      else setSums(rows || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const byKey = useMemo(() => {
    const m = new Map();
    (sums || []).forEach((s) => m.set(s.shortage_id + '|' + s.title_key, s));
    return m;
  }, [sums]);

  const rows = useMemo(() => {
    const out = [];
    data.items.forEach((i) => {
      (i.notices || []).forEach((n) => {
        const s = byKey.get(String(i.id) + '|' + titleKey(n.title));
        out.push({ product: i.product, mah: i.mah, id: i.id, ...n, summary: s ? s.summary : null });
      });
    });
    out.sort((a, b) => a.product.toLowerCase().localeCompare(b.product.toLowerCase()));
    const term = q.trim().toLowerCase();
    return term
      ? out.filter((r) => (r.product + ' ' + r.mah).toLowerCase().includes(term))
      : out;
  }, [data, q, byKey]);

  const summarised = rows.filter((r) => r.summary);

  return (
    <>
      <p className="ia-lead">
        Where a shortage has a letter from the company that markets the medicine, or advice
        from the HSE, it is listed here with a link to the original on hpra.ie. The longer
        documents are summarised at the top.
      </p>

      <input
        className="ia-search"
        type="search"
        placeholder="Search by product or company…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search notices"
      />

      {/* ---------------- summaries ---------------- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Summaries</h3>
          <span className="ia-panel-note">
            {sums === null ? 'Loading…' : `${summarised.length} of ${rows.length} notices`}
          </span>
        </div>
        <p className="ia-ns-label">
          Written by AI from each notice, checked by a pharmacist. A summary can leave things
          out: always read the full notice before acting on it.
        </p>

        {sumErr && (
          <div className="ia-alert warn">
            <strong>Summaries could not be loaded.</strong>
            <span>{sumErr}. The full list of notices below is unaffected.</span>
          </div>
        )}

        {sums !== null && summarised.length === 0 && !sumErr && (
          <p className="ia-empty small">
            {q ? 'No summarised notice matches that search.' : 'No summaries are ready yet.'}
          </p>
        )}

        <div className="ia-ns-list">
          {summarised.map((r, x) => <SummaryCard key={r.id + '-' + x} r={r} />)}
        </div>
      </section>

      {/* ---------------- every notice ---------------- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>All notices</h3>
          <span className="ia-panel-note">Links to the original documents</span>
        </div>

        {rows.length === 0 ? (
          <p className="ia-empty">
            {q ? 'Nothing matches that search.' : 'No supply notices are currently linked to shortages on the register.'}
          </p>
        ) : (
          <div className="ia-cards">
            {rows.map((r, x) => (
              <a key={r.id + '-' + x} className="ia-noticecard" href={r.url}
                 target="_blank" rel="noreferrer">
                <span className="ia-noticecard-main">
                  <strong>{r.product}</strong>
                  <span>{r.mah}{r.title ? ` · ${r.title}` : ''}</span>
                </span>
                {r.summary && <span className="ia-tag green">summary above</span>}
                <span className="ia-noticecard-go">Open on hpra.ie →</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <p className="ia-source">
        {rows.length} notice{rows.length === 1 ? '' : 's'} linked from today's register.
        Documents are written by the companies or the HSE and hosted by the HPRA, not by
        Insova. Summaries are Insova's own.
      </p>
    </>
  );
}

function SummaryCard({ r }) {
  const [open, setOpen] = useState(false);
  const s = r.summary || {};
  return (
    <article className="ia-ns-card">
      <header className="ia-ns-head">
        <div>
          <strong>{r.product}</strong>
          <span>{r.mah}{r.title ? ` · ${r.title}` : ''}</span>
        </div>
        <a className="ia-ns-link" href={r.url} target="_blank" rel="noreferrer">
          Read the full notice ↗
        </a>
      </header>

      <div className="ia-ns-cols">
        {SECTIONS.map(([k, label]) => (
          <div key={k} className={'ia-ns-sec ' + k}>
            <h4>{label}</h4>
            {(s[k] || []).length === 0 ? (
              <p className="ia-ns-none">
                {k === 'actions' ? 'The notice gives no specific instruction.' : 'Not stated in the notice.'}
              </p>
            ) : (
              <ul>
                {s[k].map((p, i) => (
                  <li key={i}>
                    {p.text}
                    {open && <q className="ia-ns-quote">{p.quote}</q>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <button className="ia-linkbtn ia-ns-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide the wording from the notice' : 'Show the wording from the notice'}
      </button>
    </article>
  );
}