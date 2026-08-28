import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { LogoutButton } from '@/components/LogoutButton';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Обзор', icon: '📊' },
  { href: '/tickets', label: 'Тикеты', icon: '🎫' },
  { href: '/categories', label: 'Категории', icon: '🗂️' },
  { href: '/panels', label: 'Панели создания', icon: '🧩' },
  { href: '/users', label: 'Пользователи', icon: '👥' },
  { href: '/logs', label: 'Журнал действий', icon: '📜' },
  { href: '/settings', label: 'Настройки', icon: '⚙️' },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-surface-border bg-surface-raised p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Image
            src="https://cdn-files.twomc.su/assets/images/logo.png"
            alt="TWOMC.SU"
            width={32}
            height={32}
            className="rounded-lg"
            unoptimized
          />
          <span className="font-semibold text-white">TWOMC.SU</span>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 space-y-2 border-t border-surface-border pt-4">
          <p className="px-2 text-xs text-slate-500">Discord ID: {session.discordUserId}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
