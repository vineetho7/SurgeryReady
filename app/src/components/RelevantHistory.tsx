import type { JSX } from 'react';
import type { RelevantCondition } from '../lib/fhir';

/**
 * Relevant history — not a chart.
 *
 * Each condition ships the recorded reason it bears on *this* episode, so the screen says
 * the same sentence the voice agent reads. The verdict is a number; this is why the number
 * matters more for this patient than for the next one.
 *
 * Renders nothing when there is nothing relevant. An empty card would imply the absence of
 * history rather than the absence of anything worth flagging.
 */
export function RelevantHistory({
  conditions,
  inline = false,
}: {
  conditions: RelevantCondition[];
  inline?: boolean;
}): JSX.Element | null {
  if (conditions.length === 0) {
    return null;
  }

  /*
   * Inline: the same sentences directly under the patient's name, where they are read as
   * part of who this patient is rather than as a card competing with the measurements.
   * Costs one line per condition instead of a full card.
   */
  if (inline) {
    return (
      <ul className="history-inline">
        {conditions.map((item) => (
          <li key={item.condition}>
            <span className="condition">
              {item.condition}
              {item.since && <span className="since"> since {item.since}</span>}
            </span>
            {item.bearing && <span className="bearing">{item.bearing}</span>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Relevant history</h2>
        <span className="meta">why this reads differently for this patient</span>
      </div>
      <div className="checks">
        {conditions.map((item) => (
          <div className="check" key={item.condition}>
            <span className="label">
              {item.condition}
              {item.since && <span className="since"> since {item.since}</span>}
            </span>
            <span className="said" style={{ fontStyle: 'normal' }}>
              {item.bearing}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
