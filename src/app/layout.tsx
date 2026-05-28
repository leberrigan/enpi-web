import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ENPI Fleet Dashboard',
  description: 'Environmental sensor monitoring for SensorGnome deployments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
