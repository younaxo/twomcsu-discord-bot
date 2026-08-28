const REASON_MESSAGES: Record<string, string> = {
  no_access:
    'У вашего аккаунта нет роли, необходимой для доступа к панели, либо вы не состоите на сервере TWOMC.SU.',
  invalid_state: 'Сессия авторизации истекла или недействительна. Попробуйте войти ещё раз.',
  rate_limit: 'Слишком много попыток входа подряд. Подождите немного и попробуйте снова.',
  error: 'При входе произошла ошибка. Попробуйте ещё раз чуть позже.',
};

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = REASON_MESSAGES[reason ?? ''] ?? REASON_MESSAGES.no_access;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-3xl">
          🚫
        </div>
        <h1 className="text-xl font-semibold text-white">Доступ запрещён</h1>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <a href="/login" className="btn-secondary mt-6 w-full">
          Вернуться к странице входа
        </a>
      </div>
    </main>
  );
}
