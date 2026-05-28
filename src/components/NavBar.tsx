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
    <header className="bg-brand-900 text-white px-6 py-3 flex items-center justify-between shadow">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
        <span className="text-brand-100">ENPI</span>
        <span className="text-white/70 font-normal text-sm">Fleet Dashboard</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-sm text-white/60 hover:text-white transition-colors">
          Admin
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
