import React from 'react';
import { fmtDate, durationText } from './useAppData';

export default function Dashboard({ app, go }) {
  const { data, pressure } = app;
  const c = data.counts;
  const m = data.meta;

  const changes = data.changes || [];
  const appeared = changes.filter((x) => x.kind === 'appeared');
  const left = changes.filter((x) => x.kind === 'left');
  const moved = changes.filter((x) => x.kind === 'date_moved');

  const topRisk = data.items.filter((i) => i.risk_band === 'high').slice(0, 6);
  const starting = data.items
    .filter((i) => i.not_started)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
    .slice(0, 6);

  return (
    <>
      {/* ---- headline: the two numbers Isobel asked to separate ---- */}
      <section className="ia-headline">
        <div className="ia-headline-main">
          <div className="ia-hl-fig">{c.current}</div>
          <div className="ia-hl-txt">
            <h2>medicines are in shortage right now</h2>
            <p>
              Products currently listed on the HPRA register as unavailable or in short
              supply. This is the number that matters at the counter today.
            </p>
          </div>
        </div>
        <div className="ia-headline-side">
          <div className="ia-hl-small">
            <span className="n">{c.hpra_total}</span>
            <span className="l">notified in total on the HPRA page</span>
            <span className="d">
              {c.resolved_still_listed
                ? `${c.resolved_still_listed} of these carries a resolution date but is still returned by the register.`
                : 'Matches our current count.'}
            </span>
          </div>
          <div className="ia-hl-small">
            <span className="n">{c.not_started}</span>
            <span className="l">announced, not yet biting</span>
            <span className="d">
              Notified with a shortage date that has not arrived. There is still time to
              order ahead on these.
            </span>
          </div>
        </div>
      </section>

      {/* ---- what changed ---- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>What changed</h3>
          <span className="ia-panel-note">
            {m.compare_day
              ? `Compared with ${m.compare_label}, the last day the register moved`
              : 'No earlier snapshot to compare against yet'}
            {m.quiet_mornings
              ? ` · stood still for ${m.quiet_mornings} morning${m.quiet_mornings > 1 ? 's' : ''} in between`
              : ''}
          </span>
        </div>

        {changes.length === 0 ? (
          <p className="ia-empty">
            Nothing has appeared, left, or had its return date moved. The register does not
            change every day; it is generally still at weekends.
          </p>
        ) : (
          <div className="ia-change-cols">
            <ChangeCol title="Appeared" tone="bad" rows={appeared} go={go} />
            <ChangeCol title="Left the register" tone="good" rows={left} go={go} />
            <ChangeCol title="Return date moved" tone="warn" rows={moved} go={go} />
          </div>
        )}

        {left.length > 0 && (
          <p className="ia-footnote">
            <strong>"Left the register" is not the same as "back in stock."</strong> It means
            the HPRA no longer lists it. Supply usually recovers before that happens, but the
            only way to know your wholesaler has it is to check.
          </p>
        )}
      </section>

      {/* ---- pressure points: real cascade signal, no invented confidence ---- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Where pressure is concentrating</h3>
          <span className="ia-panel-note">
            Active substances with more than one product short, ordered by how little is left
          </span>
        </div>
        <p className="ia-panel-lead">
          When several products of the same substance fail together, demand moves to whatever
          is left. These are the substances carrying that load today. This is what the
          register shows, not a forecast.
        </p>
        <div className="ia-press">
          {pressure.slice(0, 8).map((p) => (
            <button
              key={p.substance}
              className="ia-press-row"
              onClick={() => go('shortages', p.products[0].id)}
            >
              <span className="ia-press-name">{p.substance}</span>
              <span className="ia-press-bar" aria-hidden="true">
                <span
                  className={'fill ' + band(p.worstRisk)}
                  style={{ width: Math.max(8, p.worstRisk) + '%' }}
                />
              </span>
              <span className="ia-press-meta">
                {p.count} product{p.count > 1 ? 's' : ''} short
                {p.groupsLeft !== null && ` · ${p.groupsLeft} left across its groups`}
              </span>
            </button>
          ))}
          {pressure.length === 0 && (
            <p className="ia-empty">No substance currently has more than one product short.</p>
          )}
        </div>
      </section>

      {/* ---- highest supply risk ---- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Hardest to work around</h3>
          <span className="ia-panel-note">
            {c.high_risk} product{c.high_risk === 1 ? '' : 's'} scored high supply risk
          </span>
        </div>
        <p className="ia-panel-lead">
          Supply risk measures how difficult a shortage is to substitute around: what is left
          in the interchangeable group, how long it has run, and whether the return date has
          passed. It says nothing about how clinically important the medicine is. That call
          is yours.
        </p>
        <div className="ia-list">
          {topRisk.map((i) => (
            <button key={i.id} className="ia-list-row" onClick={() => go('shortages', i.id)}>
              <span className={'ia-risk ' + i.risk_band}>{i.risk}</span>
              <span className="ia-list-main">
                <strong>{i.product}</strong>
                <span className="ia-list-sub">
                  {i.mah}
                  {i.group ? ` · ${i.group.left} of ${i.group.total} left in group` : ' · not on the interchangeable list'}
                  {i.days_running ? ` · running ${durationText(i.days_running)}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---- announced ahead ---- */}
      {starting.length > 0 && (
        <section className="ia-panel">
          <div className="ia-panel-head">
            <h3>Starting soon</h3>
            <span className="ia-panel-note">Shortage date is still in the future</span>
          </div>
          <div className="ia-list">
            {starting.map((i) => (
              <button key={i.id} className="ia-list-row" onClick={() => go('shortages', i.id)}>
                <span className="ia-when">{fmtDate(i.start)}</span>
                <span className="ia-list-main">
                  <strong>{i.product}</strong>
                  <span className="ia-list-sub">{i.mah} · {i.reason}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="ia-source">
        Source: HPRA medicine shortage register and HPRA List of Interchangeable Medicines,
        collected {m.as_of_label}. Analysis is Insova's own. Archive covers {m.days_archived} day
        {m.days_archived === 1 ? '' : 's'} from {fmtDate(m.first_archived)}.
      </p>
    </>
  );
}

function ChangeCol({ title, tone, rows, go }) {
  return (
    <div className="ia-change-col">
      <h4 className={'ia-change-title ' + tone}>
        {title} <span>{rows.length}</span>
      </h4>
      {rows.length === 0 ? (
        <p className="ia-empty small">None</p>
      ) : (
        rows.slice(0, 8).map((r) => (
          <button key={r.kind + r.id} className="ia-change-row" onClick={() => go('shortages', r.id)}>
            <strong>{r.product}</strong>
            {r.detail && <span>{r.detail}</span>}
          </button>
        ))
      )}
    </div>
  );
}

function band(n) {
  return n >= 60 ? 'high' : n >= 30 ? 'medium' : 'low';
}