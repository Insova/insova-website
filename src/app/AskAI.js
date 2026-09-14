import React, { useMemo, useState } from 'react';
import { fmtDate, durationText } from './useAppData';
import { supabase } from '../supabaseClient';

/*
  Ask AI — natural language search over the register.

  WHAT THE MODEL DOES AND DOES NOT DO
  -----------------------------------
  It reads the question and returns a FILTER. It is never sent the
  register, never returns shortage data, and never writes a word that
  appears as fact on this screen. Every product shown below comes from
  insova-app.json in the browser, exactly as on the Shortages screen.

  So the worst a wrong answer can do is filter badly. That still
  matters: if someone asks about a drug class and the interpretation
  misses a substance, they could believe they have seen everything
  affecting them when they have not. Which is why the interpretation is
  always shown, every term is removable, and the caveat below is not
  optional.

  WHY AN EMPTY FILTER SHOWS NOTHING
  ---------------------------------
  An empty filter matches every record. So a question the model could
  not read used to render as "341 matching shortages", which is the
  whole register presented as if it were an answer. A pharmacist
  skimming that sees a result, not a failure.

  Failing to understand must look like failing to understand. If no
  filter came back, this screen says so and shows no list at all.

  It does not substitute, rank clinically, or recommend. It finds rows.
*/

const EXAMPLES = [
  'anything short for blood pressure',
  'shortages with no alternative authorised',
  'what is down to one product left in its group',
  'antibiotics that have been short over a year',
  'anything new in the last month with a supply notice',
];

export default function AskAI({ app, go }) {
  const { data } = app;
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [filter, setFilter] = useState(null);
  const [terms, setTerms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState('');

  const reasons = useMemo(
    () => [...new Set(data.items.map((i) => i.reason))].sort(),
    [data]
  );

  async function ask(phrase) {
    const text = (phrase ?? q).trim();
    if (!text || busy) return;
    setBusy(true);
    setErr('');
    setDetail('');
    try {
      const { data: res, error } = await supabase.functions.invoke('nl-search', {
        body: { q: text, reasons },
      });
      if (error) throw error;
      if (!res || !res.filter) throw new Error('No filter returned');
      setFilter(res.filter);
      setTerms(Array.isArray(res.filter.terms) ? res.filter.terms : []);
      setAsked(text);
      setQ(text);
    } catch (e) {
      setErr(
        'Could not read that as a search. The Shortages screen has the same filters if you would rather set them yourself.'
      );
      // The real reason, for you rather than for a pharmacist.
      setDetail(String((e && e.message) || e));
      // eslint-disable-next-line no-console
      console.error('nl-search failed:', e);
      setFilter(null);
      setTerms([]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQ(''); setAsked(''); setFilter(null); setTerms([]); setErr(''); setDetail('');
  }

  // Did anything actually get set? Removing every term by hand counts as
  // narrowing to nothing too, so this is recomputed from current state
  // rather than read once off the response.
  const narrowed = Boolean(
    filter && (
      terms.length > 0 ||
      filter.reason || filter.altType || filter.risk ||
      filter.group || filter.timing || filter.mine
    )
  );

  const results = useMemo(() => {
    if (!filter || !narrowed) return null;
    const nl = terms.map((t) => t.toLowerCase()).filter(Boolean);
    return data.items.filter((i) => {
      if (filter.mine) return false; // watchlist lives on Your list
      if (filter.reason && i.reason !== filter.reason) return false;
      if (filter.altType && i.alt_key !== filter.altType) return false;
      if (filter.risk && i.risk_band !== filter.risk) return false;
      if (filter.group === 'none' && i.group) return false;
      if (filter.group === 'one' && !(i.group && i.group.left === 1)) return false;
      if (filter.group === 'lowish' && !(i.group && i.group.left <= 2)) return false;
      if (filter.group === 'moved' && !(i.history && i.history.date_moves > 0)) return false;
      if (filter.timing === 'not_started' && !i.not_started) return false;
      if (filter.timing === 'past_return' && !i.past_return_date) return false;
      if (filter.timing === 'no_return' && i.expected_return) return false;
      if (filter.timing === 'over_year' && !(i.days_running && i.days_running > 365)) return false;
      if (filter.timing === 'new' && !(i.days_running !== null && i.days_running <= 30)) return false;
      if (filter.timing === 'notice' && i.notices.length === 0) return false;
      if (!nl.length) return true;
      const hay = [
        i.product, i.mah, i.reason, i.form, i.pack,
        i.substances.join(' '),
        i.group ? i.group.desc : '',
        i.licence,
      ].join(' ').toLowerCase();
      // Terms widen: any one matching is enough.
      return nl.some((t) => hay.includes(t));
    });
  }, [data, filter, terms, narrowed]);

  return (
    <>
      <section className="ia-ask-intro">
        <h3>Ask in your own words</h3>
        <p>
          Describe what you are looking for and this will set the filters for
          you. It searches today's register only. It does not predict, does not
          suggest substitutes, and does not know anything about your patients.
        </p>
      </section>

      <div className="ia-ask-box">
        <textarea
          className="ia-ask-input"
          rows={2}
          placeholder="For example: anything short for blood pressure"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
          }}
          aria-label="Ask about the shortage register"
        />
        <div className="ia-ask-actions">
          <button className="ia-ask-go" onClick={() => ask()} disabled={!q.trim() || busy}>
            {busy ? 'Reading…' : 'Ask'}
          </button>
          {(filter || asked) && (
            <button className="ia-linkbtn inline" onClick={reset}>Start again</button>
          )}
        </div>
      </div>

      {!filter && !err && (
        <div className="ia-ask-examples">
          <span>Try:</span>
          {EXAMPLES.map((x) => (
            <button key={x} className="ia-ask-eg" onClick={() => { setQ(x); ask(x); }}>
              {x}
            </button>
          ))}
        </div>
      )}

      {err && (
        <p className="ia-reading-err">
          {err}
          {detail && <><br /><span className="ia-err-detail">{detail}</span></>}
        </p>
      )}

      {/* Nothing was set. Say so and show no list: the whole register
          under a heading that says "matching" is worse than an error. */}
      {filter && !narrowed && (
        <div className="ia-reading flat">
          <div className="ia-reading-head">
            <strong>No filter set.</strong>{' '}
            {filter.reading || 'That did not translate into a search of the register.'}
          </div>
          <p className="ia-reading-warn">
            This screen only narrows today's register. It cannot count things,
            compare dates, or answer questions about what happened over time.
            Try naming a medicine, a substance, or a condition. For what has
            changed recently, Today shows appearances and departures since the
            previous collection.
          </p>
        </div>
      )}

      {filter && narrowed && (
        <>
          <div className="ia-reading">
            <div className="ia-reading-head">
              <strong>Read as:</strong> {filter.reading || 'a filter on the register'}
            </div>

            <div className="ia-reading-chips">
              {filter.reason && <Chip>reason: {filter.reason}</Chip>}
              {filter.altType && <Chip>alternative: {filter.altType}</Chip>}
              {filter.risk && <Chip>supply risk: {filter.risk}</Chip>}
              {filter.group && <Chip>group: {filter.group}</Chip>}
              {filter.timing && <Chip>timing: {filter.timing}</Chip>}
            </div>

            {terms.length > 0 && (
              <div className="ia-reading-terms">
                {terms.map((t) => (
                  <button
                    key={t}
                    className="ia-term"
                    onClick={() => setTerms(terms.filter((x) => x !== t))}
                    title="Remove this term"
                  >
                    {t} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            <p className="ia-reading-warn">
              These terms are an interpretation of your question, not a clinical
              list, and something relevant may be missing from them. If you need
              to be certain, search the substance name directly on Shortages.
            </p>
          </div>

          <div className="ia-ask-count">
            {results.length === 0
              ? 'Nothing on the register matches that.'
              : `${results.length} matching ${results.length === 1 ? 'shortage' : 'shortages'}, from ${data.items.length} on the register.`}
          </div>

          <div className="ia-list">
            {results.slice(0, 60).map((i) => (
              <button
                key={i.id}
                className="ia-list-row"
                onClick={() => go('shortages', i.id)}
              >
                <span className={'ia-risk ' + i.risk_band}>{i.risk}</span>
                <span className="ia-list-main">
                  <strong>{i.product}</strong>
                  <span className="ia-list-sub">
                    {i.substances.join(', ') || 'Substance not stated'} · {i.mah}
                    {i.group
                      ? ` · ${i.group.left} of ${i.group.total} left in group`
                      : ' · not on the interchangeable list'}
                    {i.days_running ? ` · running ${durationText(i.days_running)}` : ''}
                    {i.not_started ? ` · starts ${fmtDate(i.start)}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {results.length > 60 && (
            <p className="ia-more-note">
              Showing 60 of {results.length}. Narrow the question, or use the
              filters on Shortages.
            </p>
          )}

          <p className="ia-cite block">
            Every product listed here comes from the HPRA register as collected
            on {fmtDate(data.meta.as_of)}. The question was read by an AI model
            to work out which filters to apply; the model is not given the
            register and none of the information above is written by it.
          </p>
        </>
      )}
    </>
  );
}

function Chip({ children }) {
  return <span className="ia-chip">{children}</span>;
}