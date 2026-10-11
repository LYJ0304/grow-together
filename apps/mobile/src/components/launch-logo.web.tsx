import { Image } from 'expo-image';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { StyleSheet } from 'react-native';

import type { LaunchLogoProps } from './launch-logo';
import './launch-logo.css';

// Reveal guides traced from the PNG, not replacement artwork. The PNG is unchanged.
const guides = [
  'M224 164 H622 C752 164 829 249 829 368 C829 491 767 583 641 583 H550',
  'M479 604 C379 520 291 442 291 368 C291 275 390 246 442 320 L477 371 C524 262 613 258 652 331 C710 432 597 506 479 604',
  'M479 604 C401 681 253 784 253 940',
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
  const completionFrame = useRef<number>(0);

  useEffect(() => {
    if (played) return;
    if (typeof window.matchMedia !== 'function') {
      onComplete();
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finishIfReduced = () => {
      if (media.matches) onComplete();
    };
    finishIfReduced();
    media.addEventListener('change', finishIfReduced);
    return () => media.removeEventListener('change', finishIfReduced);
  }, [played, onComplete]);

  useEffect(() => {
    if (played || !loaded) return;
    try {
      const lengths = paths.current.map((path) => path?.getTotalLength() ?? 0);
      if (
        lengths.length !== guides.length ||
        lengths.some((length) => length <= 0)
      ) {
        onComplete();
        return;
      }
      const total = lengths.reduce((sum, length) => sum + length, 0);
      let delay = 0;
      paths.current.forEach((path, index) => {
        if (!path) return;
        const duration = (lengths[index] / total) * 2000;
        path.style.strokeDasharray = `${lengths[index]} ${lengths[index]}`;
        path.style.strokeDashoffset = String(lengths[index]);
        path.style.animationDuration = `${duration}ms`;
        path.style.animationDelay = `${delay}ms`;
        delay += duration;
      });
      setRunning(true);
      onStart();
    } catch {
      onComplete();
    }
  }, [played, loaded, onComplete, onStart]);

  useEffect(() => () => cancelAnimationFrame(completionFrame.current), []);

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
              strokeLinecap="butt"
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
                  onAnimationEnd={() => {
                    if (index !== guides.length - 1) return;
                    completionFrame.current = requestAnimationFrame(() => {
                      completionFrame.current =
                        requestAnimationFrame(onComplete);
                    });
                  }}
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
