import React from 'react';
import { fmtDate, durationText } from './useAppData';
import { NextStrip } from './Roadmap';

export default function Dashboard({ app, watch, go }) {
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

  // ---- the pharmacy's own products come first ----
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const myChanges = changes.filter((ch) => watch.ids.has(ch.id));
  const myGone = (data.recently_left || []).filter((r) => watch.ids.has(r.id));
  const myWatched = watch.rows.map((r) => byId.get(r.shortage_id)).filter(Boolean);
  const myPushed = myWatched.filter((i) => i.history && i.history.pushed_out >= 2);

  return (
    <>
      <NextStrip go={go} meta={m} />

      {/* ---- what changed, first: it is what a pharmacist opens this for ---- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>What changed</h3>
          <span className="ia-panel-note">
            {m.compare_day
              ? `Compared with ${m.compare_label}, the last day the register moved`
              : 'No earlier snapshot to compare against yet'}
            {m.quiet_mornings
              ? `. Stood still for ${m.quiet_mornings} morning${m.quiet_mornings > 1 ? 's' : ''} in between.`
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
            <ChangeCol title="Appeared" tone="bad" rows={appeared} go={go} watch={watch} />
            <ChangeCol title="Left the register" tone="good" rows={left} go={go} watch={watch} />
            <ChangeCol title="Return date moved" tone="warn" rows={moved} go={go} watch={watch} />
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

      {/* ---- your pharmacy, before the national picture ---- */}
      {watch.enabled && watch.rows.length > 0 && (
        <section className={'ia-mine' + (myChanges.length || myGone.length ? ' live' : '')}>
          <div className="ia-mine-head">
            <h3>Your list</h3>
            <button className="ia-linkbtn" onClick={() => go('watchlist')}>
              See all {watch.rows.length} →
            </button>
          </div>

          {myChanges.length === 0 && myGone.length === 0 ? (
            <p className="ia-mine-quiet">
              Nothing has changed on your {watch.rows.length} watched product
              {watch.rows.length === 1 ? '' : 's'} since {m.compare_label || 'the last collection'}.
              {myPushed.length > 0 && (
                <>
                  {' '}
                  {myPushed.length} of them {myPushed.length === 1 ? 'has' : 'have'} had a return
                  date pushed back more than once, though.
                </>
              )}
            </p>
          ) : (
            <div className="ia-mine-rows">
              {myGone.map((g) => (
                <button key={'g' + g.id} className="ia-mine-row" onClick={() => go('watchlist')}>
                  <span className="ia-tag green">off the register</span>
                  <span className="ia-mine-main">
                    <strong>{g.product}</strong>
                    <span>Left {fmtDate(g.day)}. Worth ringing your wholesaler.</span>
                  </span>
                </button>
              ))}
              {myChanges.map((ch) => (
                <button key={ch.id} className="ia-mine-row" onClick={() => go('shortages', ch.id)}>
                  <span className={'ia-tag ' + (ch.kind === 'appeared' ? 'red' : ch.kind === 'left' ? 'green' : 'amber')}>
                    {ch.kind === 'date_moved' ? 'date moved' : ch.kind === 'appeared' ? 'newly short' : ch.kind}
                  </span>
                  <span className="ia-mine-main">
                    <strong>{ch.product}</strong>
                    {ch.detail && <span>{ch.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {watch.enabled && watch.rows.length === 0 && (
        <div className="ia-callout ia-nudge">
          <strong>Everything below is the national picture.</strong>
          <p>
            Star the products you actually dispense, or are waiting on, and they will appear at
            the top of this screen with whatever has changed on them.{' '}
            <button className="ia-linkbtn inline" onClick={() => go('shortages')}>
              Start with Shortages
            </button>
          </p>
        </div>
      )}

      {/* ---- the national picture, after what changed ---- */}
      <section className="ia-headline">
        <div className="ia-headline-main">
          <div className="ia-hl-fig">{c.current}</div>
          <div className="ia-hl-txt">
            <h2>medicines are in shortage right now</h2>
            <p>
              Products currently listed on the HPRA register as unavailable or in short supply.
            </p>
          </div>
        </div>
        <div className="ia-headline-side">
          <div className="ia-hl-small">
            <span className="n">{c.hpra_total}</span>
            <span className="l">notified in total on the HPRA page</span>
            <span className="d">
              The total shown on the HPRA website.
            </span>
          </div>
          <div className="ia-hl-small">
            <span className="n">{c.not_started}</span>
            <span className="l">announced, not started yet</span>
            <span className="d">
              The shortage date on the register has not arrived. There is still time to order
              ahead on these.
            </span>
          </div>
        </div>
      </section>

      {/* ---- what the archive shows that the register cannot ---- */}
      {c.date_moved_since_watching > 0 && (
        <section className="ia-panel">
          <div className="ia-panel-head">
            <h3>Return dates that have moved</h3>
            <span className="ia-panel-note">
              Across {m.days_archived} day{m.days_archived === 1 ? '' : 's'} of our archive
            </span>
          </div>
          <p className="ia-panel-lead">
            The register shows the current expected return date and nothing else. Because we keep
            a dated copy each morning, we can see which dates have been revised and which keep
            slipping.
          </p>
          <div className="ia-list">
            {data.items
              .filter((i) => i.history && i.history.date_moves > 0)
              .sort((a, b) => b.history.pushed_out - a.history.pushed_out || b.history.date_moves - a.history.date_moves)
              .slice(0, 6)
              .map((i) => {
                const last = [...i.history.events].reverse().find((e) => e.kind === 'date_moved');
                return (
                  <button key={i.id} className="ia-list-row" onClick={() => go('shortages', i.id)}>
                    <span className="ia-list-main">
                      <strong>{i.product}</strong>
                      <span className="ia-list-sub">
                        {last
                          ? `${last.from ? fmtDate(last.from) : 'no date'} → ${last.to ? fmtDate(last.to) : 'no date'}`
                          : 'date revised'}
                        {i.history.pushed_out > 0
                          ? ` · pushed back ${i.history.pushed_out} time${i.history.pushed_out === 1 ? '' : 's'}`
                          : ' · brought forward'}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      )}

      {/* ---- pressure points ---- */}
      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Where pressure is concentrating</h3>
          <span className="ia-panel-note">
            Active substances with more than one product short, ordered by how little is left
          </span>
        </div>
        <p className="ia-panel-lead">
          When several products of the same substance fail together, demand moves to whatever is
          left. The bar shows how much of each substance&apos;s interchangeable group is already
          short: a full bar means nothing in that group is available. This is what the register
          shows, not a forecast.
        </p>
        <div className="ia-press">
          {pressure.slice(0, 8).map((p) => (
            <button
              key={p.substance}
              className="ia-press-row"
              onClick={() => go('shortages', p.products[0].id)}
            >
              <span className="ia-press-name">{p.substance}</span>
              {p.shortShare === null ? (
                <span className="ia-press-nobar">not on the interchangeable list</span>
              ) : (
                <span
                  className="ia-press-bar"
                  role="img"
                  aria-label={`${p.groupShort} of ${p.groupTotal} products short`}
                >
                  <span
                    className={'fill ' + shareBand(p.shortShare)}
                    style={{ width: Math.max(4, Math.round(p.shortShare * 100)) + '%' }}
                  />
                </span>
              )}
              <span className="ia-press-meta">
                {p.shortShare !== null
                  ? `${p.groupShort} of ${p.groupTotal} short · ${p.groupsLeft} left`
                  : `${p.count} product${p.count > 1 ? 's' : ''} short`}
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
          in the interchangeable group, how long it has run, whether the return date has
          passed, and whether that date keeps slipping. It says nothing about how clinically
          important the medicine is. That call is yours.
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

function ChangeCol({ title, tone, rows, go, watch }) {
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
            <strong>
              {watch.ids.has(r.id) && <span className="ia-mini-star" title="On your list">★</span>}
              {r.product}
            </strong>
            {r.detail && <span>{r.detail}</span>}
          </button>
        ))
      )}
    </div>
  );
}

/* Colour by how much of the group is gone, not by a risk score.
   Nothing here needs a legend: a fuller bar is a worse position. */
function shareBand(share) {
  return share >= 0.75 ? 'high' : share >= 0.4 ? 'medium' : 'low';
}