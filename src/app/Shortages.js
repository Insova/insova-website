import React, { useEffect, useMemo, useState } from 'react';
import { fmtDate, durationText, spcSearchUrl } from './useAppData';

const PAGE = 40;

export default function Shortages({ app, focusId }) {
  const { data } = app;
  const [q, setQ] = useState('');
  const [reason, setReason] = useState('all');
  const [altType, setAltType] = useState('all');
  const [risk, setRisk] = useState('all');
  const [group, setGroup] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(focusId || null);

  useEffect(() => {
    if (focusId) setOpen(focusId);
  }, [focusId]);

  const reasons = useMemo(
    () => [...new Set(data.items.map((i) => i.reason))].sort(),
    [data]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.items.filter((i) => {
      if (reason !== 'all' && i.reason !== reason) return false;
      if (altType !== 'all' && i.alt_key !== altType) return false;
      if (risk !== 'all' && i.risk_band !== risk) return false;
      if (group === 'none' && i.group) return false;
      if (group === 'one' && !(i.group && i.group.left === 1)) return false;
      if (group === 'lowish' && !(i.group && i.group.left <= 2)) return false;
      if (!term) return true;
      const hay = [
        i.product, i.mah, i.reason, i.form, i.pack,
        i.substances.join(' '),
        i.group ? i.group.desc : '',
        i.licence,
      ].join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [data, q, reason, altType, risk, group]);

  useEffect(() => { setShown(PAGE); }, [q, reason, altType, risk, group]);

  return (
    <>
      <div className="ia-filters">
        <input
          className="ia-search"
          type="search"
          placeholder="Search product, substance, company, licence…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search shortages"
        />
        <div className="ia-filter-row">
          <Select label="Reason" value={reason} onChange={setReason}
            options={[['all', 'Any reason'], ...reasons.map((r) => [r, r])]} />
          <Select label="Alternative" value={altType} onChange={setAltType}
            options={[
              ['all', 'Any classification'],
              ['Exact', 'Exact alternative'],
              ['Similar', 'Similar alternative'],
              ['Appropriate', 'Appropriate alternative'],
              ['Comparable', 'Comparable alternative'],
              ['None', 'No alternative authorised'],
            ]} />
          <Select label="Group" value={group} onChange={setGroup}
            options={[
              ['all', 'Any group status'],
              ['one', 'One product left'],
              ['lowish', 'Two or fewer left'],
              ['none', 'Not on the interchangeable list'],
            ]} />
          <Select label="Supply risk" value={risk} onChange={setRisk}
            options={[['all', 'Any risk'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />
        </div>
        <div className="ia-filter-count">
          {filtered.length === data.items.length
            ? `${data.items.length} shortages`
            : `${filtered.length} of ${data.items.length} shortages`}
          {(q || reason !== 'all' || altType !== 'all' || risk !== 'all' || group !== 'all') && (
            <button
              className="ia-linkbtn inline"
              onClick={() => { setQ(''); setReason('all'); setAltType('all'); setRisk('all'); setGroup('all'); }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="ia-empty">
          Nothing matches. Try the active substance rather than the brand name.
        </p>
      )}

      <div className="ia-cards">
        {filtered.slice(0, shown).map((i) => (
          <Row key={i.id} item={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} defs={data.alt_defs} />
        ))}
      </div>

      {filtered.length > shown && (
        <button className="ia-more" onClick={() => setShown((s) => s + PAGE)}>
          Show {Math.min(PAGE, filtered.length - shown)} more
        </button>
      )}
    </>
  );
}

function Row({ item, open, onToggle, defs }) {
  const i = item;
  return (
    <article className={'ia-card' + (open ? ' open' : '')}>
      <button className="ia-card-head" onClick={onToggle} aria-expanded={open}>
        <span className={'ia-risk ' + i.risk_band} title="Supply risk score">{i.risk}</span>
        <span className="ia-card-title">
          <strong>{i.product}</strong>
          <span className="ia-card-sub">
            {i.substances.join(', ') || 'Substance not stated'} · {i.mah}
          </span>
        </span>
        <span className="ia-card-tags">
          {i.not_started && <span className="ia-tag amber">starts {fmtDate(i.start)}</span>}
          {i.group && i.group.left === 1 && <span className="ia-tag amber">1 left in group</span>}
          {i.group && i.group.left === 0 && <span className="ia-tag red">group exhausted</span>}
          {!i.group && <span className="ia-tag grey">not on IC list</span>}
          {i.past_return_date && <span className="ia-tag red">past return date</span>}
          {i.notices.length > 0 && <span className="ia-tag green">notice</span>}
        </span>
        <span className="ia-chev" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="ia-card-body">
          <div className="ia-facts">
            <Fact k="Shortage date" v={fmtDate(i.start) + (i.not_started ? ' (not yet started)' : '')} />
            <Fact k="Running" v={i.days_running !== null ? durationText(i.days_running) : 'not started yet'} />
            <Fact k="Expected return" v={i.expected_return ? fmtDate(i.expected_return) : 'none given'} warn={i.past_return_date} />
            <Fact k="Reason" v={i.reason} />
            <Fact k="Form" v={i.form || 'not stated'} />
            <Fact k="Pack" v={i.pack || 'not stated'} />
            <Fact k="Licence" v={i.licence || 'not stated'} />
            <Fact k="Markets affected" v={i.countries} />
            <Fact k="Register last updated" v={fmtDate(i.last_updated) || 'not stated'} />
          </div>

          {/* ---- alternatives, HPRA sourced only ---- */}
          <div className="ia-sub">
            <h4>Alternatives</h4>

            <div className="ia-altclass">
              <span className={'ia-tag ' + (i.alt_key === 'None' ? 'red' : 'green')}>
                {i.alt_text || 'Not classified'}
              </span>
              <p>{defs[i.alt_key] || defs.Unknown}</p>
              <span className="ia-cite">HPRA medicine shortage register, alternative classification field</span>
            </div>

            {i.group ? (
              <>
                <p className="ia-sub-lead">
                  This product sits in an HPRA interchangeable group. Substitution at the
                  counter is only possible within this group. <strong>{i.group.short} of{' '}
                  {i.group.total}</strong> products in it are currently short.
                </p>
                <div className="ia-groupbox">
                  <div className="ia-groupbox-head">
                    <strong>{i.group.desc}</strong>
                    <span className="ia-cite">IC code {i.group.code}</span>
                  </div>
                  <div className="ia-groupbar" aria-hidden="true">
                    {Array.from({ length: i.group.total }).map((_, n) => (
                      <span key={n} className={n < i.group.short ? 'seg short' : 'seg ok'} />
                    ))}
                  </div>
                  <p className="ia-groupbox-foot">
                    {i.group.left === 0
                      ? 'Nothing in this group is available. Substitution within the group is not possible.'
                      : i.group.left === 1
                        ? 'One product is still available. Every patient on this medicine now depends on a single supplier.'
                        : `${i.group.left} products are still available.`}
                  </p>
                </div>
                <p className="ia-cite block">
                  Source: HPRA List of Interchangeable Medicines. Insova shows only what is on
                  that list and never suggests a substitute of its own. The decision is the
                  pharmacist's, in consultation with the prescriber.
                </p>
              </>
            ) : (
              <p className="ia-sub-lead warn">
                This product is not on the HPRA List of Interchangeable Medicines, so there is
                no statutory route to substitute it at the counter. It needs the prescriber, or
                an unlicensed medicine. If you source one, record it under Unlicensed so the
                next pharmacy facing this has something to go on.
              </p>
            )}
          </div>

          {/* ---- supply notices ---- */}
          {i.notices.length > 0 && (
            <div className="ia-sub">
              <h4>Manufacturer supply notices</h4>
              <p className="ia-sub-lead">
                Letters the company has issued about this shortage. We link them at source and
                do not date, summarise or interpret them: some carry no date of their own.
              </p>
              {i.notices.map((n, x) => (
                <a key={x} className="ia-notice" href={n.url} target="_blank" rel="noreferrer">
                  <span>{n.title}</span>
                  <span className="ia-notice-go">Open on hpra.ie →</span>
                </a>
              ))}
            </div>
          )}

          {/* ---- risk working ---- */}
          <div className="ia-sub">
            <h4>Why supply risk is {i.risk}</h4>
            <ul className="ia-why">
              {i.risk_why.length ? i.risk_why.map((w, x) => (
                <li key={x}><span>+{w.points}</span> {w.reason}</li>
              )) : <li>Nothing in the register marks this out as hard to work around.</li>}
            </ul>
            <p className="ia-cite block">
              Supply risk is Insova's own score, computed from the register and the
              interchangeable list. It measures how hard a shortage is to substitute around,
              not how clinically important the medicine is.
            </p>
          </div>

          <div className="ia-card-links">
            <a href={spcSearchUrl(i.product)} target="_blank" rel="noreferrer">Find the SPC on medicines.ie →</a>
            {i.info_link && <a href={i.info_link} target="_blank" rel="noreferrer">Further information from the HPRA →</a>}
          </div>
        </div>
      )}
    </article>
  );
}

function Fact({ k, v, warn }) {
  return (
    <div className="ia-fact">
      <span className="k">{k}</span>
      <span className={'v' + (warn ? ' warn' : '')}>{v}</span>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="ia-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}