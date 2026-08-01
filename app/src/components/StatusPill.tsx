import type { JSX } from 'react';
import type { Tone } from '../lib/model';

/**
 * Status is never carried by color alone — every pill ships an icon and a label, and the
 * pill tints softly from the status hue for fast scanning. Icons inherit the pill's ink
 * (currentColor), so tone stays consistent across the mark and the word.
 */
function Icon({ tone }: { tone: Tone }): JSX.Element {
  if (tone === 'good') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === 'warning') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.6l6.4 11.6H1.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 6.2v3.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  if (tone === 'critical') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M8 4.4v4.4" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="1" fill="var(--surface)" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2.4" />
    </svg>
  );
}

export function StatusPill({ tone, label }: { tone: Tone; label: string }): JSX.Element {
  return (
    <span className="pill" data-tone={tone}>
      <Icon tone={tone} />
      {label}
    </span>
  );
}
