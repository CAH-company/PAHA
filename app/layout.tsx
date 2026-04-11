import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutomationHub',
  description: 'Wewnętrzna aplikacja do zarządzania firmą',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
