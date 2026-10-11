import { Image } from 'expo-image';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { StyleSheet } from 'react-native';

import type { LaunchLogoProps } from './launch-logo';
import './launch-logo.css';

// Reveal guides traced from the PNG, not replacement artwork. The PNG is unchanged.
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
    if (typeof window.matchMedia !== 'function') {
      onComplete();
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      onComplete();
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
          const segments = paths.current.map((path, index) => {
            const length = lengths[index];
            if (path) {
              path.style.strokeDasharray = `${length} ${length}`;
              path.style.strokeDashoffset = String(length);
              // A round cap can paint a dot even when the dash has zero length.
              path.style.opacity = '0';
            }
            return { path, length };
          });
          let start: number | undefined;
          const draw = (timestamp: number) => {
            if (finished) return;
            if (start === undefined) start = timestamp;
            const time = Math.min((timestamp - start) / 2300, 1);
            const tail = Math.max(0, (time - 0.95) / 0.05);
            // Linear until the final 5%; speed then falls by just 10%, continuously.
            const progress =
              time === 1 ? 1 : (time - 0.0025 * tail * tail) / 0.9975;
            let remaining = progress * total;
            segments.forEach(({ path, length }) => {
              const drawn = Math.min(Math.max(remaining, 0), length);
              if (path) {
                path.style.strokeDashoffset = String(length - drawn);
                path.style.opacity = drawn > 0 ? '1' : '0';
                if (drawn === length) path.style.strokeDasharray = 'none';
              }
              remaining -= length;
            });
            frame = requestAnimationFrame(time < 1 ? draw : finish);
          };
          setRunning(true);
          onStart();
          frame = requestAnimationFrame(draw);
        }
      } catch {
        finish();
      }
    }
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      media.removeEventListener('change', finishIfReduced);
    };
  }, [played, loaded, onComplete, onStart]);

  return (
    <div
      className="launch-logo"
      data-drawing={played ? 'done' : running ? 'running' : 'pending'}
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
          >
            <g
              transform="scale(0.0009765625)"
              fill="none"
              stroke="white"
              strokeWidth="96"
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
                  className="launch-logo-guide"
                />
              ))}
            </g>
          </mask>
        </defs>
      </svg>
      <div
        className="launch-logo-paint"
        style={{ '--launch-mask': `url(#${maskId})` } as CSSProperties}
      >
        <Image
          source={require('../../assets/images/grow-together-logo.png')}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessible={false}
          onLoad={() => setLoaded(true)}
          onError={onComplete}
        />
      </div>
    </div>
  );
}
