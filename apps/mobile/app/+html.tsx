import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style>{`
          html, body { background-color: #FAF9F9; }
          #root { height: 100vh; height: 100dvh; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
