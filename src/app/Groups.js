import React, { useState } from 'react';

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
          note="Every product in these groups is currently short. There is no substitution available within the group." />
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
                  {g.short} of {g.total} short · IC code {g.code}
                </span>
              </span>
              <span className="ia-chev">{open === g.code ? '−' : '+'}</span>
            </button>
            {open === g.code && (
              <div className="ia-card-body">
                <div className="ia-groupbar big" aria-hidden="true">
                  {Array.from({ length: g.total }).map((_, n) => (
                    <span key={n} className={n < g.short ? 'seg short' : 'seg ok'} />
                  ))}
                </div>
                <table className="ia-table">
                  <thead>
                    <tr><th>Product</th><th>Marketing authorisation holder</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {g.members.map((m, x) => (
                      <tr key={x} className={m.short ? 'is-short' : ''}>
                        <td className="name">{m.product}</td>
                        <td>{m.mah}</td>
                        <td>
                          <span className={'ia-tag ' + (m.short ? 'red' : 'green')}>
                            {m.short ? 'short' : 'available'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="ia-cite block">
                  "Available" means this product is not currently on the HPRA shortage
                  register. It does not mean your wholesaler has it.
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ n, l, tone }) {
  return (
    <div className={'ia-gstat ' + (tone || '')}>
      <span className="n">{n}</span>
      <span className="l">{l}</span>
    </div>
  );
}