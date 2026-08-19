import React from 'react';
import { fmtDate } from './useAppData';

/*
  The history timeline.

  This is the one thing in the application that cannot be got from the
  HPRA register, because the register is overwritten every morning and
  nobody else keeps yesterday's copy. A pharmacist reading the register
  sees "expected return 30 November" and has no way to know that date
  has already been pushed three times.

  Two honesty rules are enforced here rather than left to the caller:

    * A product already listed on the first day we archived is marked
      as such. We know it was there, not when it arrived.
    * We say how many days we hold, so nobody reads a short history as
      a quiet one.
*/

const KIND = {
  baseline: { label: 'Already listed when we started watching', tone: 'grey' },
  first_listed: { label: 'Appeared on the register', tone: 'bad' },
  date_moved: { label: 'Expected return date revised', tone: 'warn' },
  reason_changed: { label: 'Reason changed', tone: 'warn' },
  left: { label: 'Left the register', tone: 'good' },
  returned: { label: 'Back on the register', tone: 'bad' },
};

export default function History({ history, daysArchived, firstArchived, compact = false }) {
  if (!history) {
    return (
      <p className="ia-sub-lead">
        No archive history for this product yet. It will build from tomorrow's collection.
      </p>
    );
  }

  const h = history;
  const events = [...h.events].reverse();

  return (
    <>
      {!compact && (
        <div className="ia-hist-summary">
          <Sum n={h.days_observed} l={h.days_observed === 1 ? 'day watched' : 'days watched'} />
          <Sum n={h.date_moves} l={h.date_moves === 1 ? 'date revision' : 'date revisions'}
               tone={h.date_moves ? 'warn' : ''} />
          <Sum n={h.pushed_out} l={h.pushed_out === 1 ? 'push back' : 'pushes back'}
               tone={h.pushed_out ? 'bad' : ''} />
          {h.pulled_in > 0 && <Sum n={h.pulled_in} l="brought forward" tone="good" />}
        </div>
      )}

      {h.pushed_out >= 2 && (
        <p className="ia-hist-verdict">
          The expected return date on this product has been pushed back {h.pushed_out} times
          since we started watching. Treat the current date with caution.
        </p>
      )}

      <ol className="ia-timeline">
        {events.map((e, i) => {
          const k = KIND[e.kind] || { label: e.kind, tone: 'grey' };
          return (
            <li key={i} className={'ia-tl ' + k.tone}>
              <span className="ia-tl-dot" aria-hidden="true" />
              <span className="ia-tl-day">{fmtDate(e.day)}</span>
              <span className="ia-tl-body">
                <strong>{k.label}</strong>
                {e.kind === 'date_moved' ? (
                  <span className="ia-tl-detail">
                    {e.from ? fmtDate(e.from) : 'no date'}
                    <span className="ia-tl-arrow" aria-hidden="true"> → </span>
                    <b className={e.from && e.to && e.to > e.from ? 'worse' : ''}>
                      {e.to ? fmtDate(e.to) : 'no date'}
                    </b>
                  </span>
                ) : e.detail ? (
                  <span className="ia-tl-detail">{e.detail}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="ia-cite block">
        {h.baseline
          ? `This product was already on the register on ${fmtDate(firstArchived)}, the first day we archived, so we do not know when it started. The register's own shortage date is shown in the facts above.`
          : `We saw this product appear on ${fmtDate(h.first_seen)}.`}
        {' '}Our archive covers {daysArchived} day{daysArchived === 1 ? '' : 's'} from{' '}
        {fmtDate(firstArchived)}. Anything that changed before then is not visible to us, and the
        HPRA register does not publish it.
      </p>
    </>
  );
}

function Sum({ n, l, tone }) {
  return (
    <div className={'ia-hist-sum ' + (tone || '')}>
      <span className="n">{n}</span>
      <span className="l">{l}</span>
    </div>
  );
}