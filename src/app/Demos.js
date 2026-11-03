import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

/*
  Demos. Admins only.

  Bookings: every demo booked from the website, soonest first. Confirm
  it, email them the Teams link, mark it done, or cancel it (which frees
  the time again on the website).

  Availability: the weekly hours offered on the website, and one-off
  times you are not free. Changes apply to the website straight away.
  Bookings already made are not touched by either.

  All times are Irish time. Tables and rules: supabase/demo_booking.sql.
*/

const TZ = 'Europe/Dublin';
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fmtDay = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const fmtLong = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtHM = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

// Half-hour steps for the hours pickers.
const STEPS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const label = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`;
};

/* Irish wall-clock date and time to an instant. */
function dublinToIso(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const at = (ms) => { const o = {}; f.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; }); return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute); };
  const guess = Date.UTC(y, m - 1, d, h, min);
  const t = guess - (at(guess) - guess);
  return new Date(guess - (at(t) - t)).toISOString();
}

const STATUS = {
  new: ['New', 'amber'],
  confirmed: ['Confirmed', 'green'],
  done: ['Done', 'grey'],
  cancelled: ['Cancelled', 'red'],
};

export default function Demos({ onCount }) {
  const [tab, setTab] = useState('bookings');
  return (
    <>
      <div className="ia-tabs">
        <button className={tab === 'bookings' ? 'on' : ''} onClick={() => setTab('bookings')}>Bookings</button>
        <button className={tab === 'hours' ? 'on' : ''} onClick={() => setTab('hours')}>Availability</button>
      </div>
      {tab === 'bookings' ? <Bookings onCount={onCount} /> : <Availability />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Bookings({ onCount }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('demo_bookings')
      .select('*')
      .order('slot_start', { ascending: true })
      .limit(500);
    if (e) { setError(e.message); setRows([]); return; }
    setRows(data || []);
    if (onCount) onCount((data || []).filter((r) => r.status === 'new').length);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    setError('');
    const { error: e } = await supabase.from('demo_bookings').update({ status }).eq('id', id);
    if (e) setError(e.message);
    load();
  };

  const now = Date.now();
  const upcoming = useMemo(() => (rows || []).filter((r) =>
    Date.parse(r.slot_start) + r.slot_minutes * 60000 > now && (r.status === 'new' || r.status === 'confirmed')), [rows, now]);
  const past = useMemo(() => (rows || []).filter((r) => !upcoming.includes(r))
    .sort((a, b) => b.slot_start.localeCompare(a.slot_start)), [rows, upcoming]);

  if (rows === null) return <p className="ia-empty">Loading…</p>;

  return (
    <>
      <p className="ia-lead">
        Demos booked from insova.ie. New ones need a reply: confirm the time and email them the
        Teams link. Cancelling frees the time on the website again.
      </p>
      {error && <div className="ia-alert error"><span>{error}</span></div>}

      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Coming up</h3>
          <span className="ia-panel-note">{upcoming.length} booked</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="ia-empty">No demos booked yet. They appear here the moment someone books on the website.</p>
        ) : (
          <div className="ia-demo-list">
            {upcoming.map((r) => <BookingCard key={r.id} r={r} setStatus={setStatus} />)}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="ia-panel">
          <div className="ia-panel-head">
            <h3>Past and cancelled</h3>
            <button className="ia-linkbtn" onClick={() => setShowPast((v) => !v)}>
              {showPast ? 'Hide' : `Show ${past.length}`}
            </button>
          </div>
          {showPast && (
            <div className="ia-demo-list">
              {past.map((r) => <BookingCard key={r.id} r={r} setStatus={setStatus} past />)}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function BookingCard({ r, setStatus, past }) {
  const start = new Date(r.slot_start);
  const [lbl, tone] = STATUS[r.status] || [r.status, 'grey'];
  const subject = encodeURIComponent('Your Insova demo');
  const body = encodeURIComponent(
    `Hi ${r.name.split(' ')[0]},\n\nThanks for booking a demo of Insova. ` +
    `This is to confirm ${fmtLong.format(start)} at ${fmtTime.format(start)} (Irish time).\n\n` +
    `Here is the Teams link: \n\nLooking forward to it.\n\nInsova\ncontact@insova.ie`
  );

  return (
    <article className={'ia-demo-card ' + r.status}>
      <div className="ia-demo-when">
        <b>{fmtDay.format(start)}</b>
        <span>{fmtTime.format(start)}</span>
      </div>
      <div className="ia-demo-who">
        <div className="ia-demo-top">
          <strong>{r.name}</strong>
          <span className={'ia-tag ' + tone}>{lbl}</span>
        </div>
        <span className="ia-demo-ph">{r.pharmacy}{r.town ? `, ${r.town}` : ''}</span>
        <span className="ia-demo-contact">
          <a href={`mailto:${r.email}`}>{r.email}</a>
          {r.phone && <> · <a href={`tel:${r.phone.replace(/\s/g, '')}`}>{r.phone}</a></>}
        </span>
        {r.notes && <p className="ia-demo-notes">{r.notes}</p>}
        <span className="ia-demo-meta">Booked {fmtDay.format(new Date(r.created_at))} at {fmtTime.format(new Date(r.created_at))}</span>
        {!past && (
          <div className="ia-demo-actions">
            {r.status === 'new' && (
              <button className="ia-btn small" onClick={() => setStatus(r.id, 'confirmed')}>Confirm</button>
            )}
            <a className="ia-linkbtn" href={`mailto:${r.email}?subject=${subject}&body=${body}`}>Email confirmation</a>
            <button className="ia-linkbtn" onClick={() => setStatus(r.id, 'done')}>Mark done</button>
            <button className="ia-linkbtn danger" onClick={() => { if (window.confirm('Cancel this demo? The time will be free on the website again.')) setStatus(r.id, 'cancelled'); }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Availability() {
  const [rules, setRules] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [blk, setBlk] = useState({ date: '', allDay: true, from: '18:00', to: '21:00', note: '' });

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('demo_availability').select('*').order('weekday'),
      supabase.from('demo_blocks').select('*').gte('ends_at', new Date().toISOString()).order('starts_at'),
    ]);
    if (a.error || b.error) { setError((a.error || b.error).message); return; }
    setRules((a.data || []).map((r) => ({ ...r, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) })));
    setBlocks(b.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const edit = (weekday, patch) => setRules((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  const saveHours = async () => {
    setError(''); setSaved('');
    for (const r of rules) {
      if (r.enabled && r.end_time <= r.start_time) { setError(`${WEEKDAYS[r.weekday - 1]}: the end time must be after the start time.`); return; }
    }
    const results = await Promise.all(rules.map((r) => supabase.from('demo_availability')
      .update({ enabled: r.enabled, start_time: r.start_time, end_time: r.end_time }).eq('weekday', r.weekday)));
    const bad = results.find((x) => x.error);
    if (bad) { setError(bad.error.message); return; }
    setSaved('Saved. The website now offers these hours.');
    load();
  };

  const addBlock = async (e) => {
    e.preventDefault();
    setError(''); setSaved('');
    if (!blk.date) { setError('Pick a date.'); return; }
    const from = blk.allDay ? '00:00' : blk.from;
    const to = blk.allDay ? null : blk.to;
    if (!blk.allDay && to <= from) { setError('The end time must be after the start time.'); return; }
    const starts = dublinToIso(blk.date, from);
    let ends;
    if (blk.allDay) {
      const [y, m, d] = blk.date.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      ends = dublinToIso(next, '00:00');
    } else {
      ends = dublinToIso(blk.date, to);
    }
    const { error: e2 } = await supabase.from('demo_blocks').insert({ starts_at: starts, ends_at: ends, note: blk.note || null });
    if (e2) { setError(e2.message); return; }
    setBlk({ date: '', allDay: true, from: '18:00', to: '21:00', note: '' });
    setSaved('Added. Those times are no longer offered on the website.');
    load();
  };

  const removeBlock = async (id) => {
    const { error: e } = await supabase.from('demo_blocks').delete().eq('id', id);
    if (e) setError(e.message);
    load();
  };

  if (rules === null && !error) return <p className="ia-empty">Loading…</p>;

  return (
    <>
      <p className="ia-lead">
        When people can book a demo on insova.ie, in Irish time. Each demo is 30 minutes, booked
        on the hour or half hour, at least three hours ahead.
      </p>
      {error && <div className="ia-alert error"><span>{error}</span></div>}
      {saved && <div className="ia-alert ok"><strong>{saved}</strong></div>}

      <section className="ia-panel">
        <div className="ia-panel-head"><h3>Weekly hours</h3></div>
        <div className="ia-hours">
          {(rules || []).map((r) => (
            <div key={r.weekday} className={'ia-hours-row' + (r.enabled ? '' : ' off')}>
              <label className="ia-toggle">
                <input type="checkbox" checked={r.enabled} onChange={(e) => edit(r.weekday, { enabled: e.target.checked })} />
                <span>{WEEKDAYS[r.weekday - 1]}</span>
              </label>
              {r.enabled ? (
                <span className="ia-hours-times">
                  <select value={r.start_time} onChange={(e) => edit(r.weekday, { start_time: e.target.value })}>
                    {STEPS.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                  </select>
                  <span>to</span>
                  <select value={r.end_time} onChange={(e) => edit(r.weekday, { end_time: e.target.value })}>
                    {STEPS.slice(1).map((t) => <option key={t} value={t}>{label(t)}</option>)}
                  </select>
                </span>
              ) : (
                <span className="ia-hours-times muted">Not available</span>
              )}
            </div>
          ))}
        </div>
        <div className="ia-form-actions">
          <button className="ia-btn" onClick={saveHours}>Save hours</button>
        </div>
      </section>

      <section className="ia-panel">
        <div className="ia-panel-head"><h3>Times you're not free</h3></div>
        <p className="ia-panel-lead">A day off, or a clash. These times are hidden on the website.</p>
        <form className="ia-block-form" onSubmit={addBlock}>
          <label>Date<input type="date" value={blk.date} onChange={(e) => setBlk((b) => ({ ...b, date: e.target.value }))} /></label>
          <label className="ia-toggle">
            <input type="checkbox" checked={blk.allDay} onChange={(e) => setBlk((b) => ({ ...b, allDay: e.target.checked }))} />
            <span>All day</span>
          </label>
          {!blk.allDay && (
            <span className="ia-hours-times">
              <select value={blk.from} onChange={(e) => setBlk((b) => ({ ...b, from: e.target.value }))}>
                {STEPS.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
              <span>to</span>
              <select value={blk.to} onChange={(e) => setBlk((b) => ({ ...b, to: e.target.value }))}>
                {STEPS.slice(1).map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </span>
          )}
          <label className="grow">Note <input value={blk.note} placeholder="Optional, only you see it" onChange={(e) => setBlk((b) => ({ ...b, note: e.target.value }))} /></label>
          <button className="ia-btn small">Add</button>
        </form>

        {blocks.length === 0 ? (
          <p className="ia-empty small">Nothing blocked.</p>
        ) : (
          <div className="ia-block-list">
            {blocks.map((b) => {
              const s = new Date(b.starts_at); const e = new Date(b.ends_at);
              const allDay = fmtHM.format(s) === '00:00' && e - s >= 23 * 3600000;
              return (
                <div key={b.id} className="ia-block-row">
                  <strong>{fmtDay.format(s)}</strong>
                  <span>{allDay ? 'All day' : `${fmtTime.format(s)} to ${fmtTime.format(e)}`}</span>
                  {b.note && <span className="muted">{b.note}</span>}
                  <button className="ia-linkbtn danger" onClick={() => removeBlock(b.id)}>Remove</button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}