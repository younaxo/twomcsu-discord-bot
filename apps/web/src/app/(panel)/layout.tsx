import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { PanelChrome } from '@/components/PanelChrome';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect('/login');

  return <PanelChrome discordUserId={session.discordUserId}>{children}</PanelChrome>;
}
