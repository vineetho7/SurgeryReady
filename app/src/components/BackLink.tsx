import type { JSX } from 'react';
import { Link } from 'react-router';

/** Drawn arrow, not a unicode glyph — the icon set is one stroke weight throughout. */
export function BackLink({ to, children }: { to: string; children: string }): JSX.Element {
  return (
    <Link to={to} className="back">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M9.5 3.5L5 8l4.5 4.5M5 8h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </Link>
  );
}

/** Direction of a day-over-day change. Down is improvement for every metric here. */
export function Delta({ value, unit }: { value: number; unit: string }): JSX.Element {
  const improving = value < 0;
  const magnitude = Math.abs(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d={improving ? 'M8 3.5v9M4.5 9L8 12.5 11.5 9' : 'M8 12.5v-9M4.5 7L8 3.5 11.5 7'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {magnitude} {magnitude === 1 ? unit : `${unit}s`} since yesterday
    </span>
  );
}
