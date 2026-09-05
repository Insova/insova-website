import React, { useState } from 'react';

/*
  What's next.

  Without this the application reads as a finished product that happens
  to be thin. It is not: it is an early build, most of it is national
  data, and the things that make it a pharmacy's own tool are still
  being made. A pharmacist should be able to see that on the first
  screen rather than work it out.

  EDIT THIS LIST, not the JSX below. Statuses are deliberately blunt:

    live      in the app now and working
    partial   in the app but not finished, and the app says how
    built     finished but not switched on
    blocked   waiting on someone outside Insova, with the reason named
    later     not started at all

  No dates. A date we miss costs more trust than a date we never gave.
*/
const ROADMAP = [
  {
    status: 'built',
    title: 'The morning brief, by email',
    body:
      'A short email each morning covering what changed overnight, leading with the products on ' +
      'your own list.',
    detail:
      'The brief is generated and you can read exactly what would arrive under Daily brief. ' +
      'Delivery is not connected yet. We would rather show you the real thing and say it is not ' +
      'sending than let you assume it is.',
  },
  {
    status: 'partial',
    title: 'History of every shortage',
    body:
      'What each shortage has actually done: when it appeared, every time the return date was ' +
      'revised, and whether it has left and come back.',
    detail:
      'Working now, but our archive only goes back as far as the day we started collecting. Most ' +
      'products were already listed by then, so their timeline starts mid-story. This gets more ' +
      'useful every single morning and cannot be backfilled, which is why it is here early rather ' +
      'than later.',
  },
  {
    status: 'live',
    title: 'Unlicensed medicines and what the PCRS paid',
    body:
      'A shared record of what was supplied when nothing on the interchangeable list covered a ' +
      'shortage, and whether the claim was reimbursed.',
    detail:
      'Live, and empty until pharmacies use it. There is no published source for this anywhere: ' +
      'every pharmacy currently works it out alone and then forgets. The first few entries are ' +
      'worth more than they look.',
  },
  {
    status: 'later',
    title: 'Prediction',
    body:
      'Flagging which medicines are likely to become hard to get, before they are notified.',
    detail:
      'This is what Insova is being built towards. A model cannot learn from a ' +
      'register that only shows today, which is why we archive it. The best published work in this ' +
      'area reached about 69% accuracy a month ahead, and it used pharmacy dispensing data rather ' +
      'than a shortage register alone. We will publish what we actually achieve, including if it ' +
      'is poor.',
    waiting: 'A longer archive, and dispensing data from partner pharmacies',
  },
  {
    status: 'later',
    title: 'Seeing stock at nearby pharmacies',
    body:
      'Who nearby is holding what, instead of ringing round one by one.',
    detail:
      'Deliberately not built. It does nothing until several pharmacies in one area are using ' +
      'Insova, and moving medicines between pharmacies touches wholesale distribution rules that ' +
      'we want a written view on before building anything.',
  },
];

const STATUS = {
  live:    { label: 'Live now',           tone: 'good' },
  partial: { label: 'Working, early',     tone: 'ok' },
  built:   { label: 'Built, not switched on', tone: 'warn' },
  blocked: { label: 'Waiting on access',  tone: 'warn' },
  later:   { label: 'Not started',        tone: 'grey' },
};

/* -------------------------------------------------------------------
   Compact strip for the top of Today.
   ------------------------------------------------------------------- */
export function NextStrip({ go, meta }) {
  const [open, setOpen] = useState(false);
  const next = ROADMAP.filter((r) => r.status === 'blocked' || r.status === 'built');

  return (
    <section className="ia-early">
      <div className="ia-early-head">
        <span className="ia-early-badge">Early access</span>
        <p>
          This is an early build. There is a lot more to be developed.
        </p>
        <button className="ia-linkbtn" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'What\u2019s coming'}
        </button>
      </div>

      {open && (
        <div className="ia-early-body">
          <ul>
            {next.map((r) => (
              <li key={r.title}>
                <span className={'ia-tag ' + toneClass(STATUS[r.status].tone)}>
                  {STATUS[r.status].label}
                </span>
                <span>
                  <strong>{r.title}</strong>
                  {r.body}
                </span>
              </li>
            ))}
          </ul>
          <button className="ia-linkbtn" onClick={() => go('roadmap')}>
            See everything that is and is not built &rarr;
          </button>
        </div>
      )}

      {!open && (
        <p className="ia-early-fine">
          Collecting since {meta.first_archived}. {meta.days_archived} day
          {meta.days_archived === 1 ? '' : 's'} of history so far.
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------
   Full screen.
   ------------------------------------------------------------------- */
export default function Roadmap({ app }) {
  const m = app.ready ? app.data.meta : null;

  return (
    <>
      <div className="ia-callout">
        <strong>What you are looking at today is mostly the national register, read closely.</strong>
        <p>
          Every current shortage, joined to the regulator&apos;s interchangeable list so you can see
          what is left in each group, with manufacturer notices linked at source. That is useful,
          and it is also the same for every pharmacy in Ireland. The parts that are about
          <em> your </em>pharmacy, your list, your unlicensed records, your wholesaler, are the ones
          still being built.
        </p>
      </div>

      <div className="ia-road">
        {ROADMAP.map((r) => {
          const s = STATUS[r.status];
          return (
            <article key={r.title} className={'ia-road-item ' + s.tone}>
              <div className="ia-road-top">
                <span className={'ia-tag ' + toneClass(s.tone)}>{s.label}</span>
                <h3>{r.title}</h3>
              </div>
              <p className="ia-road-body">{r.body}</p>
              <p className="ia-road-detail">{r.detail}</p>
              {r.waiting && (
                <p className="ia-road-waiting">
                  <span>Waiting on</span> {r.waiting}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {m && (
        <section className="ia-panel">
          <div className="ia-panel-head"><h3>Where the archive stands</h3></div>
          <p className="ia-panel-lead">
            The register is overwritten every morning, so nobody holds a record of what it said
            yesterday. Almost everything above depends on us building one.
          </p>
          <div className="ia-facts">
            <div className="ia-fact">
              <span className="k">Collecting since</span>
              <span className="v">{m.first_archived}</span>
            </div>
            <div className="ia-fact">
              <span className="k">Mornings archived</span>
              <span className="v">{m.days_archived}</span>
            </div>
            <div className="ia-fact">
              <span className="k">Last collection</span>
              <span className="v">{m.as_of_label}</span>
            </div>
          </div>
        </section>
      )}

      <div className="ia-callout">
        <strong>Tell us what is wrong with it.</strong>
        <p>
          This is being built with pharmacists rather than for them, and the most useful thing you
          can send is the bit that annoyed you. If a number looks wrong we want to hear the same
          day: it comes from public data anyone can check, and if ours disagrees with the
          HPRA&apos;s then ours is the one to fix.{' '}
          <a href="mailto:contact@insova.ie">contact@insova.ie</a>
        </p>
      </div>

      <p className="ia-source">
        Insova is an information tool. It never substitutes, orders or dispenses, and nothing in it
        is clinical guidance. Alternatives are shown only where the HPRA List of Interchangeable
        Medicines lists them, cited by IC code.
      </p>
    </>
  );
}

function toneClass(tone) {
  return tone === 'good' ? 'green'
    : tone === 'warn' ? 'amber'
    : tone === 'ok' ? 'green'
    : 'grey';
}