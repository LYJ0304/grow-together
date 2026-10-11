import { useEffect, useRef, useState } from 'react';
import drawing from '../../assets/images/launch-drawing-masks/drawing.json';
import { createLogoRenderer } from './launch-logo-renderer';
import type { LaunchLogoProps } from './launch-logo';
import './launch-logo.css';

const original: {
  uri: string;
} = require('../../assets/images/grow-together-logo.png');
const sheets: { uri: string }[][] = [
  [
    require('../../assets/images/launch-drawing-masks/stroke-1-1x.png'),
    require('../../assets/images/launch-drawing-masks/stroke-1-2x.png'),
  ],
  [
    require('../../assets/images/launch-drawing-masks/stroke-2-1x.png'),
    require('../../assets/images/launch-drawing-masks/stroke-2-2x.png'),
  ],
];
export default function LaunchLogo({
  played,
  onComplete,
  onStart,
}: LaunchLogoProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const originalImage = useRef<HTMLImageElement>(null);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const [mode, setMode] = useState<'pending' | 'running' | 'done' | 'static'>(
    played ? 'static' : 'pending',
  );
  const showOriginal = mode === 'static' || (played && mode !== 'done');
  useEffect(() => {
    const element = canvas.current!;
    const lost = (event: Event) => {
      event.preventDefault();
      setMode('static');
    };
    element.addEventListener('webglcontextlost', lost);
    return () => element.removeEventListener('webglcontextlost', lost);
  }, []);
  useEffect(() => {
    if (played) return;
    let stopped = false,
      frame = 0,
      start: number | undefined,
      last = 0;
    let renderer: ReturnType<typeof createLogoRenderer> | undefined;
    const finish = (drawn = false) => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      setMode(drawn ? 'done' : 'static');
      onComplete(drawn);
    };
    const resize = () => {
      try {
        renderer?.resize();
        renderer?.draw(last);
      } catch {
        finish();
      }
    };
    if (typeof window.matchMedia !== 'function') {
      finish();
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => {
      if (media.matches) finish();
    };
    if (media.addEventListener) media.addEventListener('change', reduce);
    else media.addListener(reduce);
    window.addEventListener('resize', resize);
    if (media.matches) finish();
    else {
      const elements = [originalImage.current, ...images.current];
      if (
        elements.some((image) => !image || typeof image.decode !== 'function')
      )
        finish();
      else
        Promise.all([
          ...elements.map((image) => image!.decode()),
          document.fonts?.ready ?? Promise.resolve(),
        ]).then(
          () => {
            if (stopped) return;
            try {
              renderer = createLogoRenderer(
                canvas.current!,
                images.current as HTMLImageElement[],
              );
              const tick = (timestamp: number) => {
                if (stopped) return;
                if (start === undefined) {
                  start = timestamp;
                  canvas.current!.dataset.startTime = String(timestamp);
                  setMode('running');
                  onStart();
                }
                last = Math.min(timestamp - start, drawing.durationMs);
                try {
                  renderer!.draw(last);
                } catch {
                  finish();
                  return;
                }
                if (last < drawing.durationMs)
                  frame = requestAnimationFrame(tick);
                else frame = requestAnimationFrame(() => finish(true));
              };
              // Resources and the empty frame are ready before the drawing clock starts.
              frame = requestAnimationFrame(() => {
                if (!stopped) frame = requestAnimationFrame(tick);
              });
            } catch {
              finish();
            }
          },
          () => finish(),
        );
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      renderer?.dispose();
      window.removeEventListener('resize', resize);
      if (media.removeEventListener)
        media.removeEventListener('change', reduce);
      else media.removeListener(reduce);
    };
  }, [played, onComplete, onStart]);
  return (
    <div
      className="launch-logo"
      data-drawing={played || mode === 'done' ? 'done' : mode}
      data-rendering={showOriginal ? 'original' : 'webgl'}
      aria-hidden="true"
    >
      <img
        ref={originalImage}
        src={original.uri}
        alt=""
        className="launch-logo-original"
      />
      <canvas
        ref={canvas}
        className="launch-logo-canvas"
        width="145"
        height="145"
      />
      {!showOriginal &&
        mode !== 'done' &&
        sheets.map((sources, index) => (
          <picture key={index} className="launch-logo-preload">
            <source
              media="(prefers-reduced-motion: reduce)"
              srcSet={original.uri}
            />
            <source
              srcSet={sources
                .map((source, scale) => `${source.uri} ${scale + 1}x`)
                .join(', ')}
            />
            <img
              ref={(image) => {
                images.current[index] = image;
              }}
              src={sources[0].uri}
              alt=""
            />
          </picture>
        ))}
    </div>
  );
}
