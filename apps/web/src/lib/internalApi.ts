// Клиент внутреннего API бота. Используется для всего, что требует живого подключения к Discord:
// проверка роли/членства, публикация панелей, любые действия с тикетами.
import { env } from '@/env';

export class InternalApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.INTERNAL_API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': env.INTERNAL_API_SECRET,
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'unknown' }));
    throw new InternalApiError(
      body.error ?? `Ошибка запроса к боту (${response.status})`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export interface BotStatus {
  online: boolean;
  uptimeMs: number;
  wsPing: number;
  guildMemberCount: number;
  appVersion: string;
}

export interface MembershipInfo {
  inGuild: boolean;
  hasAccessRole: boolean;
  username?: string;
  globalName?: string | null;
  avatarUrl?: string;
}

export const botApi = {
  status: () => request<BotStatus>('/internal/status').catch(() => null),
  membership: (userId: string) => request<MembershipInfo>(`/internal/membership/${userId}`),
  syncMembers: () => request<{ synced: number }>('/internal/members/sync', { method: 'POST' }),
  publishPanel: (panelId: string) =>
    request<{ messageId: string; updated: boolean }>(`/internal/panels/${panelId}/publish`, {
      method: 'POST',
    }),
  claimTicket: (ticketId: string, actorId: string) =>
    request(`/internal/tickets/${ticketId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ actorId }),
    }),
  closeTicket: (ticketId: string, actorId: string, reason: string) =>
    request(`/internal/tickets/${ticketId}/close`, {
      method: 'POST',
      body: JSON.stringify({ actorId, reason }),
    }),
  reopenTicket: (ticketId: string, actorId: string) =>
    request(`/internal/tickets/${ticketId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ actorId }),
    }),
  deleteTicket: (ticketId: string, actorId: string) =>
    request(`/internal/tickets/${ticketId}`, {
      method: 'DELETE',
      body: JSON.stringify({ actorId }),
    }),
  addTicketMember: (ticketId: string, actorId: string, userId: string) =>
    request(`/internal/tickets/${ticketId}/members`, {
      method: 'POST',
      body: JSON.stringify({ actorId, userId }),
    }),
  removeTicketMember: (ticketId: string, actorId: string, userId: string) =>
    request(`/internal/tickets/${ticketId}/members/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ actorId }),
    }),
  notifyAudit: (actorId: string, label: string, details?: string) =>
    request('/internal/audit/notify', {
      method: 'POST',
      body: JSON.stringify({ actorId, label, details }),
    }).catch(() => undefined),
};
