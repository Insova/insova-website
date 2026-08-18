import React from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fmtDate, durationText } from './useAppData';

/*
  The daily brief.

  Isobel asked whether this view is only for us while pharmacies just get
  an email. The answer shown here is: this screen IS the email. It is a
  preview of the message that would land in the inbox, so a pharmacist
  can see exactly what they are signing up to receive and nothing is
  hidden behind an operator-only view.

  Sending is not wired up yet, which the screen says plainly rather than
  implying a service that does not exist.
*/
export default function Digest({ app }) {
  const { data, pressure } = app;
  const { pharmacy, profile } = useAuth();
  const c = data.counts;

  const changes = data.changes || [];
  const appeared = changes.filter((x) => x.kind === 'appeared');
  const left = changes.filter((x) => x.kind === 'left');
  const moved = changes.filter((x) => x.kind === 'date_moved');
  const high = data.items.filter((i) => i.risk_band === 'high').slice(0, 5);
  const starting = data.items.filter((i) => i.not_started).slice(0, 5);

  return (
    <>
      <p className="ia-lead">
        A short brief each morning, so nothing depends on remembering to open a dashboard.
        This is the email itself, not a summary of it: what you see here is what would arrive.
      </p>

      <div className="ia-callout">
        <strong>Sending is not switched on yet.</strong>
        <p>
          The brief is generated but not yet delivered by email. We would rather show you the
          real thing and tell you it is not sending than let you assume it is.
        </p>
      </div>

      <div className="ia-email">
        <div className="ia-email-head">
          <div>
            <span className="k">To</span>
            <span className="v">{profile?.email}</span>
          </div>
          <div>
            <span className="k">Subject</span>
            <span className="v">
              Insova brief, {data.meta.as_of_label}: {c.current} short
              {appeared.length ? `, ${appeared.length} new` : ''}
              {c.groups_last_product ? `, ${c.groups_last_product} group${c.groups_last_product > 1 ? 's' : ''} down to one` : ''}
            </span>
          </div>
        </div>

        <div className="ia-email-body">
          <p className="ia-email-hello">
            Good morning{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
            Here is where the register stands for {pharmacy?.name || 'your pharmacy'} this morning.
          </p>

          <div className="ia-email-nums">
            <span><b>{c.current}</b> in shortage</span>
            <span><b>{appeared.length}</b> new</span>
            <span><b>{left.length}</b> off the register</span>
            <span><b>{c.groups_last_product}</b> groups down to one</span>
          </div>

          {appeared.length > 0 && (
            <Block title="New on the register">
              {appeared.slice(0, 8).map((r) => (
                <li key={r.id}><b>{r.product}</b>{r.detail ? ` — ${r.detail.toLowerCase()}` : ''}</li>
              ))}
            </Block>
          )}

          {starting.length > 0 && (
            <Block title="Announced, not yet biting">
              {starting.map((i) => (
                <li key={i.id}><b>{i.product}</b> — supply expected to be affected from {fmtDate(i.start)}</li>
              ))}
            </Block>
          )}

          {high.length > 0 && (
            <Block title="Hardest to work around today">
              {high.map((i) => (
                <li key={i.id}>
                  <b>{i.product}</b> —{' '}
                  {i.group
                    ? `${i.group.left} of ${i.group.total} left in its interchangeable group`
                    : 'not on the interchangeable list'}
                  {i.days_running ? `, running ${durationText(i.days_running)}` : ''}
                </li>
              ))}
            </Block>
          )}

          {pressure.length > 0 && (
            <Block title="Where pressure is building">
              {pressure.slice(0, 4).map((p) => (
                <li key={p.substance}>
                  <b>{p.substance}</b> — {p.count} products short
                  {p.groupsLeft !== null ? `, ${p.groupsLeft} left across its groups` : ''}
                </li>
              ))}
            </Block>
          )}

          {left.length > 0 && (
            <Block title="Off the register">
              {left.slice(0, 8).map((r) => <li key={r.id}><b>{r.product}</b></li>)}
              <li className="ia-email-caveat">
                Off the register is not the same as back on your shelf. Check your wholesaler.
              </li>
            </Block>
          )}

          {moved.length > 0 && (
            <Block title="Return dates moved">
              {moved.slice(0, 6).map((r) => (
                <li key={r.id}><b>{r.product}</b> — {r.detail}</li>
              ))}
            </Block>
          )}

          {changes.length === 0 && (
            <p className="ia-email-quiet">
              The register has not moved since {data.meta.compare_label || 'the last collection'}.
              It is generally still at weekends.
            </p>
          )}

          <p className="ia-email-foot">
            Source: HPRA medicine shortage register and HPRA List of Interchangeable Medicines,
            collected {data.meta.as_of_label}. The analysis is Insova's own. This is an
            information tool: it never substitutes, orders or dispenses, and nothing in it is
            clinical guidance.
          </p>
        </div>
      </div>
    </>
  );
}

function Block({ title, children }) {
  return (
    <div className="ia-email-block">
      <h4>{title}</h4>
      <ul>{children}</ul>
    </div>
  );
}