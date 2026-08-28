import Image from 'next/image';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';

export default async function LoginPage() {
  const session = await requireSession();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm text-center">
        <Image
          src="https://cdn-files.twomc.su/assets/images/logo.png"
          alt="TWOMC.SU"
          width={72}
          height={72}
          className="mx-auto mb-4 rounded-2xl"
          unoptimized
        />
        <h1 className="text-xl font-semibold text-white">Панель управления</h1>
        <p className="mt-2 text-sm text-muted">
          Доступ только для администраторов сервера TWOMC.SU с ролью управления ботом.
        </p>
        <a href="/api/auth/login" className="btn-primary mt-6 w-full">
          Войти через Discord
        </a>
      </div>
    </main>
  );
}
