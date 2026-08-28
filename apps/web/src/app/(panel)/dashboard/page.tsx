import { prisma } from '@twomcsu/db';
import { formatDuration } from '@twomcsu/shared';
import { botApi } from '@/lib/internalApi';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const [status, openTickets, closedTickets, ratingAgg, ratingCount] = await Promise.all([
    botApi.status(),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'CLAIMED'] }, deletedAt: null } }),
    prisma.ticket.count({ where: { status: 'CLOSED', deletedAt: null } }),
    prisma.ticketRating.aggregate({ _avg: { score: true } }),
    prisma.ticketRating.count(),
  ]);

  let dbHealthy = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbHealthy = false;
  }

  return {
    status,
    openTickets,
    closedTickets,
    avgRating: ratingAgg._avg.score,
    ratingCount,
    dbHealthy,
  };
}

function StatCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'bad' | 'neutral';
}) {
  const toneClass =
    tone === 'ok' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="card">
      <p className="text-sm text-slate-400">{title}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { status } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Обзор</h1>
        <p className="text-sm text-slate-400">Текущее состояние бота, базы данных и тикетов.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          title="Статус бота"
          value={status?.online ? 'Онлайн' : 'Оффлайн'}
          tone={status?.online ? 'ok' : 'bad'}
        />
        <StatCard title="Время работы" value={status ? formatDuration(status.uptimeMs) : '—'} />
        <StatCard title="Пинг WebSocket" value={status ? `${Math.round(status.wsPing)} мс` : '—'} />
        <StatCard
          title="База данных"
          value={data.dbHealthy ? 'Подключена' : 'Недоступна'}
          tone={data.dbHealthy ? 'ok' : 'bad'}
        />
        <StatCard
          title="Участников сервера"
          value={status ? String(status.guildMemberCount) : '—'}
        />
        <StatCard title="Открытых тикетов" value={String(data.openTickets)} />
        <StatCard title="Закрытых тикетов" value={String(data.closedTickets)} />
        <StatCard
          title="Средняя оценка"
          value={data.avgRating ? data.avgRating.toFixed(2) : '—'}
          sub={`Оценок: ${data.ratingCount}`}
        />
      </div>

      {!status && (
        <div className="card border-red-500/30 bg-red-500/5 text-sm text-red-300">
          Не удалось связаться с ботом. Проверьте, что контейнер бота запущен и внутреннее API
          доступно.
        </div>
      )}
    </div>
  );
}
