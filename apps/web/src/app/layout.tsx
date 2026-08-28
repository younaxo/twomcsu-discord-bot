import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Панель управления TWOMC.SU',
  description: 'Панель управления Discord-ботом сообщества TWOMC.SU',
  icons: { icon: 'https://cdn-files.twomc.su/assets/images/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
