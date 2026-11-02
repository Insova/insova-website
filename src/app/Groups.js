import React, { useState } from 'react';

/*
  Running low.

  "Left" is the number of products in the interchangeable group that are
  neither on the shortage register NOR recorded by the HPRA as not
  marketed (export_app_data.py). A licence for a product nobody can buy
  is not an alternative.

  Each product's status here must agree with that count, so there are
  three, the same three as the Alternatives section on Shortages:

    short          on the HPRA shortage register
    not marketed   authorised, but the HPRA lists it as not marketed,
                   or its licence is withdrawn
    available      neither. Includes "market status unknown", because
                   not knowing must not be turned into "gone".

  Before this, every product that was not short said "available", so a
  group could read "1 left" above four products marked available.
*/

const state = (m) => (m.short ? 'short' : m.marketed === false ? 'off' : 'ok');
const ORDER = { ok: 0, off: 1, short: 2 };
const LABEL = { ok: 'available', off: 'not marketed', short: 'short' };
const TONE = { ok: 'green', off: 'grey', short: 'red' };

export default function Groups({ app }) {
  const { data } = app;
  const groups = data.groups || [];
  const [open, setOpen] = useState(null);

  const exhausted = groups.filter((g) => g.left === 0);
  const one = groups.filter((g) => g.left === 1);
  const two = groups.filter((g) => g.left === 2);

  return (
    <>
      <div className="ia-gstats">
        <Stat n={data.counts.groups_affected} l="groups touched by a current shortage" />
        <Stat n={one.length} l="down to a single product" tone="warn" />
        <Stat n={exhausted.length} l="with nothing left" tone={exhausted.length ? 'bad' : ''} />
      </div>

      {exhausted.length > 0 && (
        <Section title="Nothing left" tone="bad" groups={exhausted} open={open} setOpen={setOpen}
          note="Every product in these groups is either short or not marketed. There is no substitution available within the group." />
      )}
      {one.length > 0 && (
        <Section title="One product left" tone="warn" groups={one} open={open} setOpen={setOpen}
          note="A single supplier is carrying the whole group. If it fails, there is no counter substitution left." />
      )}
      {two.length > 0 && (
        <Section title="Two products left" tone="ok" groups={two} open={open} setOpen={setOpen}
          note="Still substitutable, but with little headroom if another product goes." />
      )}

      {groups.length === 0 && (
        <p className="ia-empty">
          No interchangeable group is currently down to two products or fewer. If this seems
          wrong, the interchangeable reference file may not have loaded on the last run.
        </p>
      )}

      <p className="ia-source">
        Source: HPRA List of Interchangeable Medicines, matched to the shortage register by
        licence number. Insova shows only what is on that list.
      </p>
    </>
  );
}

function Section({ title, tone, groups, note, open, setOpen }) {
  return (
    <section className="ia-panel">
      <div className="ia-panel-head">
        <h3>{title}</h3>
        <span className="ia-panel-note">{groups.length} group{groups.length === 1 ? '' : 's'}</span>
      </div>
      <p className="ia-panel-lead">{note}</p>
      <div className="ia-cards">
        {groups.map((g) => (
          <article key={g.code} className={'ia-card' + (open === g.code ? ' open' : '')}>
            <button className="ia-card-head" onClick={() => setOpen(open === g.code ? null : g.code)}>
              <span className={'ia-risk ' + (tone === 'bad' ? 'high' : tone === 'warn' ? 'medium' : 'low')}>
                {g.left}
              </span>
              <span className="ia-card-title">
                <strong>{g.desc}</strong>
                <span className="ia-card-sub">
                  {g.short} of {g.total} short
                  {g.not_marketed > 0 && ` · ${g.not_marketed} not marketed`}
                  {` · ${g.left} left`} · IC code {g.code}
                </span>
              </span>
              <span className="ia-chev">{open === g.code ? '−' : '+'}</span>
            </button>
            {open === g.code && (
              <div className="ia-card-body">
                <div className="ia-groupbar big" aria-hidden="true">
                  {sorted(g.members).map((m, n) => (
                    <span key={n} className={'seg ' + state(m)} />
                  ))}
                </div>
                <table className="ia-table">
                  <thead>
                    <tr><th>Product</th><th>Marketing authorisation holder</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {sorted(g.members).map((m, x) => (
                      <tr key={x} className={m.short ? 'is-short' : state(m) === 'off' ? 'is-off' : ''}>
                        <td className="name">{m.product}</td>
                        <td>{m.mah}</td>
                        <td>
                          <span className={'ia-tag ' + TONE[state(m)]}>{LABEL[state(m)]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="ia-cite block">
                  "Available" means the product is not on the HPRA shortage register and the
                  HPRA does not list it as not marketed. It does not mean your wholesaler has it.
                  "Not marketed" products are licensed but not on the market, so they are not
                  counted as left.
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/* Available first, then not marketed, then short: what you can reach for, first. */
function sorted(members) {
  return [...(members || [])].sort((a, b) => ORDER[state(a)] - ORDER[state(b)]);
}

function Stat({ n, l, tone }) {
  return (
    <div className={'ia-gstat ' + (tone || '')}>
      <span className="n">{n}</span>
      <span className="l">{l}</span>
    </div>
  );
}