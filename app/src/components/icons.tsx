import type { JSX } from 'react';

/**
 * One drawn icon set, one stroke weight. No unicode glyphs, no emoji — every icon is an
 * authored SVG on a 24-grid with a 1.7 stroke, inheriting currentColor.
 */

type IconProps = { size?: number };

function base(size: number): { width: number; height: number; viewBox: string; fill: string } {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' };
}

const S = {
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconBoard({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" {...S} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" {...S} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" {...S} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" {...S} />
    </svg>
  );
}

export function IconClipboard({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <rect x="5" y="4.5" width="14" height="16" rx="2.4" {...S} />
      <path d="M9 4.5V3.5a1 1 0 011-1h4a1 1 0 011 1v1" {...S} />
      <path d="M8.5 12l2 2 4-4.2" {...S} />
    </svg>
  );
}

export function IconPulse({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M3 12h3.5l2-6 3.5 12 2.5-8 1.7 4H21" {...S} />
    </svg>
  );
}

export function IconAlert({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M12 3.6l8.5 15.4H3.5z" {...S} />
      <path d="M12 9.5v4" {...S} />
      <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCalendar({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.4" {...S} />
      <path d="M3.5 9.5h17M8 3.5v3.5M16 3.5v3.5" {...S} />
    </svg>
  );
}

export function IconShieldCheck({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M12 3l7 2.4v5.2c0 4.6-3 8-7 10-4-2-7-5.4-7-10V5.4z" {...S} />
      <path d="M9 11.7l2 2 4-4.3" {...S} />
    </svg>
  );
}

export function IconGauge({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M4 15a8 8 0 0116 0" {...S} />
      <path d="M12 15l4-3.5" {...S} />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTarget({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" {...S} />
      <circle cx="12" cy="12" r="4.2" {...S} />
      <circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconWalk({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <circle cx="13" cy="4.7" r="1.7" {...S} />
      <path d="M11.4 8.2l2.6 1.2 1.8 2.4M12.4 21l1.2-5-2.2-2 .8-4.6-2.6 2.2L9 14" {...S} />
    </svg>
  );
}

export function IconLayers({ size = 18 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M12 3.6l8.5 4.4-8.5 4.4L3.5 8z" {...S} />
      <path d="M4 12l8 4.2 8-4.2M4 15.8l8 4.2 8-4.2" {...S} />
    </svg>
  );
}

export function IconSun({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <circle cx="12" cy="12" r="4" {...S} />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" {...S} />
    </svg>
  );
}

export function IconMoon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" {...S} />
    </svg>
  );
}
