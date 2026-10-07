import React, { useCallback, useEffect, useRef, useState } from 'react';

/*
  The guided tour.

  Started from the Tour button in the top bar, and offered once to
  first-time users. It walks through every screen in the order a
  pharmacist would meet them, opening each one and saying in a sentence
  or two what it is for.

  HOW IT FINDS THINGS
  -------------------
  Elements are found by data-tour attributes that AppShell puts on the
  navigation, the freshness label and the main content area. Nothing in
  the individual screens is touched, so a screen can change without
  breaking the tour. If a target cannot be found, the step still shows,
  centred, rather than failing.

  THREE KINDS OF STEP
  -------------------
    target: null         a centred card, for the welcome and the end
    target: 'body'       opens the screen in `view`, lights up the main
                         area so the screen itself is visible, and pulses
                         its menu item
    target: 'freshness'  lights up the "Register collected" label

  THE WORDING
  -----------
  Every step describes only what the app does today. The daily brief is
  described as not sending yet, because it isn't. Alternatives are
  described as coming only from the HPRA list, because that is the rule.
  If a screen changes, change its step.
*/

export const STEPS = [
  {
    target: null,
    title: 'Welcome to Insova',
    body: 'This takes about two minutes and opens each screen in turn. You can leave at any time, and start it again from the Tutorial button at the top.',
  },
  {
    target: 'freshness',
    view: 'dashboard',
    title: 'When the data is from',
    body: 'Every morning Insova collects the HPRA shortage register. This shows when the copy you are looking at was collected. If it is more than a day old, a warning appears.',
  },
  {
    target: 'body',
    view: 'dashboard',
    title: 'Today',
    body: 'Start here. Since the previous collection: what appeared on the register, what left it, and which expected return dates moved. Anything on your own list comes first.',
  },
  {
    target: 'body',
    view: 'watchlist',
    title: 'Your list',
    body: 'Star the medicines you dispense. If anything changes on them, it is waiting at the top of Today the next morning. Your list is private to you.',
  },
  {
    target: 'body',
    view: 'shortages',
    title: 'Shortages',
    body: 'Everything on the register right now. Search by product, active substance, company or licence number, and filter by reason, timing or supply risk.',
  },
  {
    target: 'body',
    view: 'shortages',
    title: 'Inside a shortage',
    body: 'Click any shortage to open it. History shows every change to its return date since we started collecting. Alternatives come only from the HPRA List of Interchangeable Medicines. Supply risk is how hard it is to work around, not how clinically important it is.',
  },
  {
    target: 'body',
    view: 'medicines',
    title: 'All medicines',
    body: 'Every authorised and withdrawn medicine in Ireland, about 30,000. Use it when someone asks about a medicine that is not on the shortage register. You can star products here too.',
  },
  {
    target: 'body',
    view: 'groups',
    title: 'Running low',
    body: 'Interchangeable groups with only one or two products still available. When a group runs out, substituting at the counter is no longer possible.',
  },
  {
    target: 'body',
    view: 'notices',
    title: 'Notices',
    body: 'Letters manufacturers have issued about a shortage. We link to the copy the HPRA publishes and never summarise or reword them.',
  },
  {
    target: 'body',
    view: 'ulm',
    title: 'Unlicensed medicines',
    body: 'A record, shared within your pharmacy, of unlicensed medicines sourced when nothing licensed was available. Never enter patient details here.',
  },
  {
    target: 'body',
    view: 'digest',
    title: 'Daily brief',
    body: 'A preview of the short morning email Insova will send. It is not sending yet.',
  },
  {
    target: 'body',
    view: 'feedback',
    title: 'Give feedback',
    body: 'If something is confusing, wrong or missing, tell us here. We read every message.',
  },
  {
    target: null,
    view: 'dashboard',
    title: 'That is everything',
    body: 'Start this again any time from the tutorial button at the top of the screen. Insova is information only and never substitutes, orders or dispenses. The decision is always yours.',
  },
];

const NARROW = 900;

function findTarget(target) {
  if (!target) return null;
  return document.querySelector(`[data-tour="${target}"]`);
}

/* The part of an element that is actually on screen. The main content
   area can be far taller than the window. */
function visibleRect(el) {
  const r = el.getBoundingClientRect();
  const top = Math.max(r.top, 8);
  const left = Math.max(r.left, 8);
  const bottom = Math.min(r.bottom, window.innerHeight - 8);
  const right = Math.min(r.right, window.innerWidth - 8);
  if (bottom - top < 12 || right - left < 12) return null;
  return { top, left, width: right - left, height: bottom - top };
}

export default function Tour({ open, onClose, go }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const cardRef = useRef(null);
  const goRef = useRef(go);
  goRef.current = go;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  // Open the screen this step is about.
  useEffect(() => {
    if (!open) return;
    const v = STEPS[i].view;
    if (v) goRef.current(v);
  }, [open, i]);

  const measure = useCallback(() => {
    setNarrow(window.innerWidth <= NARROW);
    const el = findTarget(STEPS[i].target);
    setRect(el ? visibleRect(el) : null);
  }, [i]);

  // Measure after the screen has had a moment to render.
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(measure, 80);
    let raf = 0;
    const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, { passive: true });
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again);
    };
  }, [open, measure]);

  // Pulse the menu item for the screen being shown, so it is clear where
  // in the navigation this lives.
  useEffect(() => {
    if (!open) return undefined;
    const v = STEPS[i].view;
    if (!v || STEPS[i].target !== 'body') return undefined;
    const item = findTarget('nav-' + v);
    if (!item) return undefined;
    item.classList.add('ia-tour-pulse');
    return () => item.classList.remove('ia-tour-pulse');
  }, [open, i]);

  // Keyboard: arrows to move, Escape to leave.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus to the card on each step, for keyboard and screen reader users.
  useEffect(() => {
    if (open && cardRef.current) cardRef.current.focus();
  }, [open, i]);

  if (!open) return null;

  const next = () => (last ? onClose() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  // Where the card sits.
  let cardStyle;
  let cardClass = 'ia-tour-card';
  if (narrow) {
    cardClass += ' docked';
  } else if (!rect || !step.target) {
    cardClass += ' centred';
  } else if (step.target === 'body') {
    cardClass += ' corner';
  } else {
    // Below the highlighted element, kept on screen.
    const width = 340;
    const left = Math.max(16, Math.min(rect.left + rect.width - width, window.innerWidth - width - 16));
    cardStyle = { top: rect.top + rect.height + 14, left, width };
  }

  return (
    <div className="ia-tour" role="dialog" aria-modal="true" aria-labelledby="ia-tour-title">
      {/* Catches clicks so the app underneath can't be used mid-tour. */}
      <div className={'ia-tour-veil' + (rect && step.target ? '' : ' full')} />

      {rect && step.target && (
        <div
          className="ia-tour-hole"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
          aria-hidden="true"
        />
      )}

      <div ref={cardRef} className={cardClass} style={cardStyle} tabIndex={-1}>
        <div className="ia-tour-progress" aria-hidden="true">
          {STEPS.map((_, n) => <span key={n} className={n <= i ? 'on' : ''} />)}
        </div>
        <p className="ia-tour-count">Step {i + 1} of {STEPS.length}</p>
        <h2 id="ia-tour-title">{step.title}</h2>
        <p className="ia-tour-body">{step.body}</p>
        <div className="ia-tour-actions">
          <button type="button" className="ia-tour-skip" onClick={onClose}>
            {last ? 'Close' : 'Leave tutorial'}
          </button>
          <span className="ia-tour-nav">
            {i > 0 && (
              <button type="button" className="ia-tour-back" onClick={back}>Back</button>
            )}
            <button type="button" className="ia-tour-next" onClick={next}>
              {last ? 'Finish' : i === 0 ? 'Start' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}