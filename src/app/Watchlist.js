import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fmtDate, durationText } from './useAppData';
import { WatchStar } from './useWatchlist';
import History from './History';

/*
  Your list.

  The pharmacy's own products, and what has happened to them. Everything
  else in the app is the same for every pharmacy in Ireland; this screen
  is the one that is about this dispensary.

  A product on the list can also disappear from the register, which is
  the thing a pharmacist actually wants to hear about. Those are held at
  the top rather than silently dropped.
*/
export default function Watchlist({ app, watch, go }) {
  const { data } = app;
  const { pharmacy } = useAuth();
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [open, setOpen] = useState(null);

  const byId = useMemo(
    () => new Map(data.items.map((i) => [i.id, i])),
    [data]
  );
  const changeById = useMemo(() => {
    const m = new Map();
    (data.changes || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [data]);
  const leftById = useMemo(() => {
    const m = new Map();
    (data.recently_left || []).forEach((r) => m.set(r.id, r));
    return m;
  }, [data]);

  const watched = watch.rows
    .map((r) => ({ row: r, item: byId.get(r.shortage_id), gone: leftById.get(r.shortage_id) }))
    .filter((x) => x.item || x.gone);

  const stillShort = watched.filter((x) => x.item);
  const gone = watched.filter((x) => !x.item && x.gone);
  const missing = watch.rows.length - watched.length;

  const withChanges = stillShort.filter((x) => changeById.has(x.row.shortage_id));

  const saveNote = async (id) => {
    await watch.setNote(id, noteText.trim());
    setNoteFor(null);
    setNoteText('');
  };

  if (!watch.enabled) {
    return <p className="ia-empty">Your account is not linked to a pharmacy, so there is no list to keep.</p>;
  }

  if (watch.rows.length === 0) {
    return (
      <>
        <p className="ia-lead">
          This is where your pharmacy's own products live. Star anything on the Shortages screen
          and it appears here, with whatever has changed on it since the register last moved.
        </p>
        <div className="ia-callout">
          <strong>This list is yours alone.</strong>
          <p>
            Nobody else sees it, including colleagues at {pharmacy?.name || 'this pharmacy'} and
            including us. It is a working note about what you are chasing, not a shared record.
          </p>
        </div>

        <div className="ia-callout">
          <strong>Why bother, when the whole register is already searchable?</strong>
          <p>
            Because 371 shortages is a national figure and only a handful of them are yours.
            Starring the ones you actually dispense, or are waiting on, turns a list of
            everything into a list of what matters here. It is also the list the wholesaler
            back-in-stock alerts will run against once we have that access.
          </p>
        </div>
        <div className="ia-empty-cta">
          <p>Nothing on your list yet.</p>
          <button className="ia-btn" onClick={() => go('shortages')}>Go to Shortages</button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="ia-lead">
        {stillShort.length} product{stillShort.length === 1 ? '' : 's'} on your list
        {withChanges.length > 0 && `, ${withChanges.length} with something new`}
        {gone.length > 0 && `, ${gone.length} off the register`}.
      </p>

      {gone.length > 0 && (
        <section className="ia-panel">
          <div className="ia-panel-head">
            <h3>Off the register</h3>
            <span className="ia-panel-note">These left while you were watching them</span>
          </div>
          <p className="ia-panel-lead">
            The HPRA no longer lists these as short. That is not the same as your wholesaler
            having stock, but it is the point at which it is worth ringing to check.
          </p>
          <div className="ia-list">
            {gone.map(({ row, gone: g }) => (
              <div key={row.shortage_id} className="ia-list-row static">
                <span className="ia-tag green">left {fmtDate(g.day)}</span>
                <span className="ia-list-main">
                  <strong>{row.product}</strong>
                  <span className="ia-list-sub">
                    Watched for {g.days_watched} day{g.days_watched === 1 ? '' : 's'}
                    {g.date_moves > 0 && ` · return date was revised ${g.date_moves} time${g.date_moves === 1 ? '' : 's'} first`}
                  </span>
                </span>
                <button className="ia-linkbtn" onClick={() => watch.remove(row.shortage_id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Still short</h3>
          <span className="ia-panel-note">
            Changes shown are against {data.meta.compare_label || 'the previous collection'}
          </span>
        </div>

        {stillShort.length === 0 ? (
          <p className="ia-empty">Nothing on your list is currently on the register.</p>
        ) : (
          <div className="ia-cards">
            {stillShort.map(({ row, item }) => {
              const ch = changeById.get(row.shortage_id);
              const isOpen = open === row.shortage_id;
              return (
                <article key={row.shortage_id} className={'ia-card' + (isOpen ? ' open' : '')}>
                  <div className="ia-card-head as-row">
                    <WatchStar item={item} watch={watch} />
                    <button
                      className="ia-card-hit"
                      onClick={() => setOpen(isOpen ? null : row.shortage_id)}
                      aria-expanded={isOpen}
                    >
                      <span className="ia-card-title">
                        <strong>{item.product}</strong>
                        <span className="ia-card-sub">
                          {item.mah}
                          {item.expected_return
                            ? ` · expected back ${fmtDate(item.expected_return)}`
                            : ' · no expected return date'}
                          {item.days_running ? ` · short ${durationText(item.days_running)}` : ''}
                        </span>
                      </span>
                      <span className="ia-card-tags">
                        {ch && ch.kind === 'date_moved' && <span className="ia-tag amber">date moved</span>}
                        {item.history && item.history.pushed_out >= 2 && (
                          <span className="ia-tag red">pushed back {item.history.pushed_out}×</span>
                        )}
                        {item.past_return_date && <span className="ia-tag red">past return date</span>}
                        {item.group && item.group.left <= 1 && (
                          <span className="ia-tag amber">{item.group.left} left in group</span>
                        )}
                      </span>
                      <span className="ia-chev">{isOpen ? '−' : '+'}</span>
                    </button>
                  </div>

                  {ch && (
                    <div className="ia-watch-change">
                      <span className="ia-tag amber">since {data.meta.compare_label}</span>
                      <span>{ch.kind === 'date_moved' ? `Return date moved ${ch.detail}` : ch.detail || ch.kind}</span>
                    </div>
                  )}

                  {row.note && noteFor !== row.shortage_id && (
                    <div className="ia-watch-note">
                      <span>{row.note}</span>
                      <button className="ia-linkbtn" onClick={() => { setNoteFor(row.shortage_id); setNoteText(row.note || ''); }}>
                        Edit
                      </button>
                    </div>
                  )}

                  {noteFor === row.shortage_id && (
                    <div className="ia-watch-noteedit">
                      <input
                        value={noteText}
                        placeholder="e.g. two patients on this, Mrs K due 14th"
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveNote(row.shortage_id)}
                      />
                      <button className="ia-btn small" onClick={() => saveNote(row.shortage_id)}>Save</button>
                      <button className="ia-linkbtn" onClick={() => setNoteFor(null)}>Cancel</button>
                    </div>
                  )}

                  {isOpen && (
                    <div className="ia-card-body">
                      <div className="ia-facts">
                        <F k="Shortage date" v={fmtDate(item.start)} />
                        <F k="Expected return" v={item.expected_return ? fmtDate(item.expected_return) : 'none given'} warn={item.past_return_date} />
                        <F k="Reason" v={item.reason} />
                        <F k="Supply risk" v={`${item.risk} of 100`} />
                        {item.group && <F k="Group" v={`${item.group.left} of ${item.group.total} still available`} />}
                      </div>

                      <div className="ia-sub">
                        <h4>What this product has done</h4>
                        <History
                          history={item.history}
                          daysArchived={data.meta.days_archived}
                          firstArchived={data.meta.first_archived}
                        />
                      </div>

                      <div className="ia-card-links">
                        <button className="ia-linkbtn" onClick={() => go('shortages', item.id)}>
                          Open full detail →
                        </button>
                        {!row.note && noteFor !== row.shortage_id && (
                          <button className="ia-linkbtn" onClick={() => { setNoteFor(row.shortage_id); setNoteText(''); }}>
                            Add a note
                          </button>
                        )}
                        <button className="ia-linkbtn danger" onClick={() => watch.remove(row.shortage_id)}>
                          Remove from list
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {missing > 0 && (
        <p className="ia-source">
          {missing} item{missing === 1 ? '' : 's'} on your list {missing === 1 ? 'is' : 'are'} no
          longer in today's export and we have no record of {missing === 1 ? 'it' : 'them'}{' '}
          leaving. That usually means the collection changed shape rather than the shortage
          resolving. Worth checking the HPRA directly.
        </p>
      )}
    </>
  );
}

function F({ k, v, warn }) {
  return (
    <div className="ia-fact">
      <span className="k">{k}</span>
      <span className={'v' + (warn ? ' warn' : '')}>{v}</span>
    </div>
  );
}