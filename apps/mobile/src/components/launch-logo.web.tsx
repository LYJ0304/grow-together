import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

import type { LaunchLogoProps } from './launch-logo';
import './launch-logo.css';

const logo: {
  uri: string;
} = require('../../assets/images/grow-together-logo.png');
// shortcut: These reveal guides approximate the PNG; replace only with the original stroke SVG.
// Only the heart and stem connect; keep the upper curve as a separate stroke.
const guides = [
  'M224 164 H622 C752 164 829 249 829 368 C829 491 767 583 641 583 H550',
  'M479 604 C379 520 291 442 291 368 C291 275 390 246 442 320 L477 371 C524 262 613 258 652 331 C710 432 597 506 479 604 C401 681 253 784 253 940',
];

export default function LaunchLogo({
  played,
  onComplete,
  onStart,
}: LaunchLogoProps) {
  const maskId = `launch-mask-${useId().replace(/:/g, '')}`;
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (played) return;
    let cancelled = false;
    // A cached image can load before hydration attaches its event handler.
    const image = new window.Image();
    image.src = logo.uri;
    image.decode().then(
      () => {
        if (!cancelled) setLoaded(true);
      },
      () => {
        if (!cancelled) onComplete();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [played, onComplete]);

  useEffect(() => {
    if (played) return;
    if (typeof window.matchMedia !== 'function') {
      onComplete();
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations: Animation[] = [];
    let frame = 0;
    let finished = false;
    const finish = (drawn = false) => {
      if (finished) return;
      finished = true;
      paths.current.forEach((path) => {
        if (!path) return;
        path.style.strokeDashoffset = '0';
        path.style.strokeDasharray = 'none';
        path.style.opacity = '1';
      });
      animations.forEach((animation) => animation.cancel());
      cancelAnimationFrame(frame);
      onComplete(drawn);
    };
    const finishIfReduced = () => {
      if (media.matches) finish();
    };
    media.addEventListener('change', finishIfReduced);
    if (media.matches) {
      finish();
    } else if (loaded) {
      try {
        const lengths = paths.current.map(
          (path) => path?.getTotalLength() ?? 0,
        );
        if (
          lengths.length !== guides.length ||
          lengths.some((length) => !Number.isFinite(length) || length <= 0)
        ) {
          finish();
        } else {
          const total = lengths.reduce((sum, length) => sum + length, 0);
          let distance = 0;
          paths.current.forEach((path, index) => {
            if (!path) return;
            const length = lengths[index];
            const start = (distance / total) * 0.9975;
            const end =
              index === guides.length - 1
                ? 1
                : ((distance + length) / total) * 0.9975;
            const duration = (end - start) * 2300;
            const reveal = Math.min(1, duration / 2);
            const keyframes: Keyframe[] = [
              { strokeDashoffset: String(length), opacity: 0, offset: 0 },
              {
                strokeDashoffset: String(
                  length - Math.min(length, (total * reveal) / (2300 * 0.9975)),
                ),
                opacity: 1,
                offset: reveal / duration,
              },
            ];
            if (index === guides.length - 1) {
              // Normalize distance for a continuous 10% slowdown in the final 5%.
              keyframes.push({
                strokeDashoffset: String(total * (1 - 0.95 / 0.9975)),
                opacity: 1,
                offset: (0.95 - start) / (end - start),
                easing: 'cubic-bezier(0.333333, 0.350877, 0.666667, 0.684211)',
              });
            }
            keyframes.push({ strokeDashoffset: '0', opacity: 1, offset: 1 });
            path.style.strokeDasharray = `${length} ${length}`;
            path.style.strokeDashoffset = String(length);
            path.style.opacity = '0';
            const stroke = path.animate(keyframes, {
              duration,
              delay: start * 2300,
              easing: 'linear',
              fill: 'both',
            });
            stroke.pause();
            stroke.currentTime = 0;
            animations.push(stroke);
            distance += length;
          });
          // Start on the first visible frame; hidden tabs must not consume the drawing.
          frame = requestAnimationFrame((timestamp) => {
            if (finished) return;
            animations.forEach((animation) => {
              animation.play();
              animation.startTime = timestamp;
            });
            setRunning(true);
            onStart();
          });
          Promise.all(animations.map((animation) => animation.finished)).then(
            () => {
              if (!finished) frame = requestAnimationFrame(() => finish(true));
            },
            () => finish(),
          );
        }
      } catch {
        finish();
      }
    }
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      animations.forEach((animation) => animation.cancel());
      media.removeEventListener('change', finishIfReduced);
    };
  }, [played, loaded, onComplete, onStart]);

  return (
    <div
      className="launch-logo"
      data-drawing={played ? 'done' : running ? 'running' : 'pending'}
      style={{ '--launch-mask': `url(#${maskId})` } as CSSProperties}
      aria-hidden="true"
    >
      <svg width="0" height="0" className="launch-logo-defs">
        <defs>
          <mask
            id={maskId}
            maskUnits="objectBoundingBox"
            maskContentUnits="objectBoundingBox"
            x="0"
            y="0"
            width="1"
            height="1"
            style={{ maskType: 'alpha' }}
          >
            {played && <rect width="1" height="1" fill="white" />}
            <g
              transform="scale(0.0009765625)"
              fill="none"
              stroke="white"
              strokeWidth="56"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {guides.map((d, index) => (
                <path
                  key={d}
                  ref={(path) => {
                    paths.current[index] = path;
                  }}
                  d={d}
                  opacity="0"
                  className="launch-logo-guide"
                />
              ))}
            </g>
          </mask>
        </defs>
      </svg>
      <img src={logo.uri} alt="" className="launch-logo-paint" />
    </div>
  );
}
