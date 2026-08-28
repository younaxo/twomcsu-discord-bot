'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Ticket,
  FolderKanban,
  LayoutTemplate,
  Users,
  ScrollText,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { LogoutButton } from '@/components/LogoutButton';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard },
  { href: '/tickets', label: 'Тикеты', icon: Ticket },
  { href: '/categories', label: 'Категории', icon: FolderKanban },
  { href: '/panels', label: 'Панели создания', icon: LayoutTemplate },
  { href: '/users', label: 'Пользователи', icon: Users },
  { href: '/logs', label: 'Журнал действий', icon: ScrollText },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1" aria-label="Основная навигация">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? 'bg-brand/15 font-medium text-brand' : 'text-muted hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2">
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
  );
}

export function PanelChrome({
  discordUserId,
  children,
}: {
  discordUserId: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Закрываем мобильное меню при переходе на другую страницу и при Escape.
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Верхняя панель — только на мобильных/планшетах, стеклянная согласно правилам стекла для навигации. */}
      <header className="glass sticky top-0 z-40 flex items-center justify-between px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          className="btn-ghost !min-h-11 !min-w-11 p-0"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="mobile-nav"
        className={`glass fixed inset-y-0 left-0 z-30 flex w-72 flex-col p-4 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 lg:border-r lg:border-surface-border ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 hidden lg:block">
          <Logo />
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
        <div className="mt-4 space-y-2 border-t border-surface-border pt-4">
          <p className="truncate px-2 text-xs text-muted">Discord ID: {discordUserId}</p>
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
