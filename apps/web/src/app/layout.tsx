import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Панель управления TWOMC.SU',
  description: 'Панель управления Discord-ботом сообщества TWOMC.SU',
  icons: { icon: 'https://cdn-files.twomc.su/assets/images/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
