import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ENPI Fleet Dashboard',
  description: 'Environmental sensor monitoring for SensorGnome deployments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Next.js hoists <link>/<meta> found anywhere in the tree into <head>.
          /shared/motus-tools.css is served by the shared tools host itself
          (see Motus AWS repo's STYLE_GUIDE.md) and only resolves once ENPI is
          deployed behind that domain — see the file for the local-dev note. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/shared/motus-tools.css" />
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
