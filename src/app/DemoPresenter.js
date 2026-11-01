import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate } from './useAppData';

/*
  Demo mode presenter panel (#/demo, admins only).

  For screen-shared demos. Two jobs:

  1. A READY-MADE "YOUR LIST". An empty list makes half the product
     invisible, so on first open it stars a handful of products chosen
     from TODAY's real register, each picked to show something off: one
     that appeared overnight, one whose return date just moved, one that
     keeps slipping, one down to the last product in its group, one with
     a supply notice, one not started yet. Nothing is invented; if today
     has no example of something, that step simply says so.
     The list lives in this browser only (SandboxAuthProvider), never in
     the real watchlist table.

  2. A RUNNING ORDER. Each step jumps straight to the right screen or
     product, with one line to say. "Hide" folds it to a small tab so
     the shared screen stays clean; Esc does the same.

  "Reset demo" clears the list and any dismissed alerts and starts again.
*/

const DISMISS_KEY = 'insova.dismissed.sandbox';
const STORE_KEY = 'insova.demo.watchlist';

function pickExamples(data) {
  const items = data.items || [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const changes = data.changes || [];
  const firstChange = (kind) => {
    const c = changes.find((x) => x.kind === kind && byId.has(x.id));
    return c ? byId.get(c.id) : null;
  };
  const used = new Set();
  const take = (it) => { if (it && !used.has(it.id)) { used.add(it.id); return it; } return null; };
  const find = (fn) => take(items.find((i) => !used.has(i.id) && fn(i)));

  return {
    appeared: take(firstChange('appeared')),
    moved: take(firstChange('date_moved')),
    slipping: find((i) => i.history && i.history.pushed_out >= 2),
    lastOne: find((i) => i.group && i.group.left === 1),
    notice: find((i) => (i.notices || []).length > 0),
    starting: find((i) => i.not_started),
  };
}

export default function DemoPresenter({ app, watch, go, view, onExit }) {
  const { data } = app;
  const ex = useMemo(() => pickExamples(data), [data]);
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const seeded = useRef(false);

  // Star the examples once, on a fresh demo list.
  useEffect(() => {
    if (seeded.current || watch.loading) return;
    seeded.current = true;
    if (watch.rows.length || watch.licenceRows.length) return;
    Object.values(ex).filter(Boolean).forEach((it) => watch.add(it));
    if (ex.slipping) {
      watch.setNote(ex.slipping.id, 'Demo note: wholesaler says end of month, ordered from second supplier');
    }
  }, [ex, watch]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen((v) => !v); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const none = 'No example on today\'s register; skip this one.';
  const steps = [
    { label: 'Today', screen: 'dashboard', go: () => go('dashboard'),
      say: `What changed overnight: ${(data.changes || []).length} changes since ${data.meta.compare_label || 'the last collection'}. Your list sits above the national picture.` },
    { label: 'Your list', screen: 'watchlist', go: () => go('watchlist'),
      say: 'The products this pharmacy dispenses, with news on them. Show Dismiss on a moved date, and the supply note.' },
    { label: 'Newly short', screen: 'shortages', go: () => ex.appeared && go('shortages', ex.appeared.id),
      say: ex.appeared ? `${ex.appeared.product} appeared overnight. Open the card: reason, dates, alternatives.` : none },
    { label: 'Return date moved', screen: 'shortages', go: () => ex.moved && go('shortages', ex.moved.id),
      say: ex.moved ? `${ex.moved.product}: the return date moved last night. The register only shows the new date; we show the change.` : none },
    { label: 'Keeps slipping', screen: 'shortages', go: () => ex.slipping && go('shortages', ex.slipping.id),
      say: ex.slipping ? `${ex.slipping.product}: pushed back ${ex.slipping.history.pushed_out} times. Only our daily archive can show this.` : none },
    { label: 'Alternatives', screen: 'shortages', go: () => ex.lastOne && go('shortages', ex.lastOne.id),
      say: ex.lastOne ? `${ex.lastOne.product}: one product left in its interchangeable group. Alternatives come only from the HPRA list.` : none },
    { label: 'Running low', screen: 'groups', go: () => go('groups'),
      say: 'Substances where most of the group is already short, so demand is about to land on what is left.' },
    { label: 'Starting soon', screen: 'shortages', go: () => go('shortages', null, 'not_started'),
      say: ex.starting ? `Announced but not started yet, e.g. ${ex.starting.product} from ${fmtDate(ex.starting.start)}. Time to order ahead.` : 'Announced but not started yet: time to order ahead.' },
    { label: 'Notices', screen: 'notices', go: () => go('notices'),
      say: 'Long manufacturer letters in three lines, every point backed by a quote, reviewed by the team.' },
    { label: 'All medicines', screen: 'medicines', go: () => go('medicines'),
      say: 'Every authorised and withdrawn product in Ireland. Star one that is not short and Insova flags it the morning it goes short.' },
    { label: 'Daily brief', screen: 'digest', go: () => go('digest'),
      say: 'The morning summary for this pharmacy.' },
    { label: "What's next", screen: 'roadmap', go: () => go('roadmap'),
      say: 'Wholesaler availability is the missing piece: is it short, and can I actually get it?' },
  ];

  const goStep = (n) => {
    const k = Math.max(0, Math.min(steps.length - 1, n));
    setStep(k);
    steps[k].go();
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(STORE_KEY);
      window.localStorage.removeItem(DISMISS_KEY);
    } catch (e) { /* blocked */ }
    window.location.reload();
  };

  if (!open) {
    return (
      <button type="button" className="ia-demo-tab" onClick={() => setOpen(true)} title="Show presenter panel (Esc)">
        ▶ Demo
      </button>
    );
  }

  const s = steps[step];
  return (
    <aside className="ia-demo" aria-label="Demo presenter">
      <div className="ia-demo-top">
        <strong>Demo mode</strong>
        <span>Live data · nothing saved</span>
        <button type="button" className="ia-demo-x" onClick={() => setOpen(false)} title="Hide (Esc)">Hide</button>
      </div>

      <ol className="ia-demo-steps">
        {steps.map((st, i) => (
          <li key={st.label}>
            <button
              type="button"
              className={(i === step ? 'on ' : '') + (view === st.screen ? 'here' : '')}
              onClick={() => goStep(i)}
            >
              <span className="n">{i + 1}</span>{st.label}
            </button>
          </li>
        ))}
      </ol>

      <p className="ia-demo-say">{s.say}</p>

      <div className="ia-demo-nav">
        <button type="button" onClick={() => goStep(step - 1)} disabled={step === 0}>← Back</button>
        <button type="button" className="next" onClick={() => goStep(step + 1)} disabled={step === steps.length - 1}>Next →</button>
      </div>

      <div className="ia-demo-foot">
        <button type="button" onClick={reset}>Reset demo</button>
        <button type="button" onClick={onExit}>Exit demo</button>
      </div>
    </aside>
  );
}