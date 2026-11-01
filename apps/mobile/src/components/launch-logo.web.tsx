import { useEffect, useRef, useState } from 'react';
import emblem from '../../assets/images/brand/emblem.json';
import type { LaunchLogoProps } from './launch-logo';
import './launch-logo.css';

export default function LaunchLogo({
  played,
  onComplete,
  onStart,
}: LaunchLogoProps) {
  const svg = useRef<SVGSVGElement>(null);
  const callbacks = useRef({ onComplete, onStart });
  const [mode, setMode] = useState<'pending' | 'running' | 'done'>(
    played ? 'done' : 'pending',
  );

  // Callback identity changes must not restart a gesture already in progress.
  useEffect(() => {
    callbacks.current = { onComplete, onStart };
  }, [onComplete, onStart]);
  useEffect(() => {
    if (played) return;
    const paths = Array.from(svg.current!.querySelectorAll('path'));
    const animations: Animation[] = [];
    let stopped = false;
    const finish = (drawn = false) => {
      if (stopped) return;
      stopped = true;
      clearTimeout(watchdog);
      // Commit the final artwork before dropping animation effects, even on failure.
      paths.forEach((path) => {
        path.style.strokeDashoffset = '0';
        path.style.opacity = '1';
      });
      animations.forEach((animation) => animation.cancel());
      setMode('done');
      callbacks.current.onComplete(drawn);
    };
    const watchdog = setTimeout(finish, emblem.durationMs + 1100);
    let media: MediaQueryList | null = null;
    const reduce = () => {
      if (media?.matches) finish();
    };
    try {
      media =
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : null;
      if (
        !media ||
        media.matches ||
        paths.some((path) => typeof path.animate !== 'function')
      ) {
        finish();
      } else {
        if (media.addEventListener) media.addEventListener('change', reduce);
        else media.addListener(reduce);
        for (const [index, path] of paths.entries()) {
          const stroke = emblem.strokes[index];
          animations.push(
            path.animate(
              [
                { strokeDashoffset: 1, opacity: 0, offset: 0 },
                { strokeDashoffset: 0.99999, opacity: 1, offset: 0.00001 },
                { strokeDashoffset: 0, opacity: 1, offset: 1 },
              ],
              {
                duration: stroke.durationMs,
                delay: stroke.delayMs,
                easing: 'linear',
                fill: 'both',
              },
            ),
          );
        }
        setMode('running');
        callbacks.current.onStart();
        Promise.all(animations.map((animation) => animation.finished)).then(
          () => finish(true),
          () => finish(),
        );
      }
    } catch {
      finish();
    }
    return () => {
      stopped = true;
      clearTimeout(watchdog);
      animations.forEach((animation) => animation.cancel());
      if (media?.removeEventListener)
        media.removeEventListener('change', reduce);
      else media?.removeListener?.(reduce);
    };
  }, [played]);

  return (
    <div
      className="launch-logo"
      data-drawing={played ? 'done' : mode}
      aria-hidden="true"
    >
      <svg
        ref={svg}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={emblem.viewBox}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {emblem.strokes.map(({ id, d, stroke, strokeWidth }) => (
          <path
            key={id}
            id={id}
            d={d}
            stroke={stroke}
            strokeWidth={strokeWidth}
            pathLength="1"
          />
        ))}
      </svg>
      <noscript>
        <style>
          {
            '.launch-logo path{opacity:1!important;stroke-dasharray:none!important}[data-testid=launch-title]{opacity:1!important}'
          }
        </style>
      </noscript>
    </div>
  );
}
