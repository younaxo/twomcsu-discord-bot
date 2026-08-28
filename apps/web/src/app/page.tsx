import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';

export default async function RootPage() {
  const session = await requireSession();
  redirect(session ? '/dashboard' : '/login');
}
