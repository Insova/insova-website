import React, { useMemo, useState } from 'react';

export default function Notices({ app }) {
  const { data } = app;
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const out = [];
    data.items.forEach((i) => {
      i.notices.forEach((n) => {
        out.push({ product: i.product, mah: i.mah, id: i.id, ...n });
      });
    });
    out.sort((a, b) => a.product.toLowerCase().localeCompare(b.product.toLowerCase()));
    const term = q.trim().toLowerCase();
    return term
      ? out.filter((r) => (r.product + ' ' + r.mah).toLowerCase().includes(term))
      : out;
  }, [data, q]);

  return (
    <>
      <p className="ia-lead">
        Where a shortage has a letter attached from the company that markets the medicine, we
        carry the link straight through to the document on hpra.ie. These are supply status
        notices: what has happened and when the company expects supply to recover.
      </p>

      <div className="ia-callout">
        <strong>We do not date, summarise or interpret these.</strong>
        <p>
          Some carry no date of their own and others carry several, including batch release
          dates that are not the date of the letter. Rather than show you a date we cannot
          stand over, we show none. Open each one at source and read it yourself.
        </p>
      </div>

      <input
        className="ia-search"
        type="search"
        placeholder="Search by product or company…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search notices"
      />

      {rows.length === 0 ? (
        <p className="ia-empty">
          {q ? 'Nothing matches that search.' : 'No supply notices are currently linked to shortages on the register.'}
        </p>
      ) : (
        <div className="ia-cards">
          {rows.map((r, x) => (
            <a
              key={r.id + x}
              className="ia-noticecard"
              href={r.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ia-noticecard-main">
                <strong>{r.product}</strong>
                <span>{r.mah}</span>
              </span>
              <span className="ia-noticecard-go">Open on hpra.ie →</span>
            </a>
          ))}
        </div>
      )}

      <p className="ia-source">
        {rows.length} notice{rows.length === 1 ? '' : 's'} linked from today's register.
        Documents are hosted by the HPRA, not by Insova.
      </p>
    </>
  );
}