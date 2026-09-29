'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NavBar() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    // Matches the shared .tool-header pattern (back link to the tool hub +
    // this tool's own <h1>) — see Motus AWS repo's STYLE_GUIDE.md. The
    // back link resolves once ENPI is deployed behind the shared domain;
    // until then it stays within this app.
    <header className="bg-white border-b border-motus-border px-6 py-3 flex flex-wrap items-center justify-between gap-2">
      <Link href="/" className="font-bold text-sm text-motus-primary hover:text-motus-primary-hover whitespace-nowrap">
        &lsaquo; Motus Tools
      </Link>
      <Link href="/dashboard" className="flex items-center gap-2 text-lg">
        <span className="font-bold text-motus-dark">ENPI</span>
        <span className="text-motus-muted font-normal text-sm">Fleet Dashboard</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-sm text-motus-muted hover:text-motus-primary transition-colors">
          Admin
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-motus-muted hover:text-motus-primary transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
