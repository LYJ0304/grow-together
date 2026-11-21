import type { Metadata } from "next";
import { DemoProvider } from "@/lib/demo-context";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Overview · Grow Together Admin Demo",
    template: "%s · Grow Together Admin Demo",
  },
  description:
    "Frontend-only admin console prototype. All data is fictional; no authentication or production integrations.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
