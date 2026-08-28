// Общие константы, значения enum'ов и ограничения, единые для бота и веб-панели.

export const TICKET_STATUS = ['OPEN', 'CLAIMED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];

export const AUDIT_ACTION = [
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DELETED',
  'PANEL_PUBLISHED',
  'PANEL_UPDATED',
  'TICKET_CREATED',
  'TICKET_CLAIMED',
  'TICKET_UNCLAIMED',
  'TICKET_CLOSED',
  'TICKET_REOPENED',
  'TICKET_DELETED',
  'TICKET_MEMBER_ADDED',
  'TICKET_MEMBER_REMOVED',
  'TICKET_RATED',
  'SETTINGS_UPDATED',
  'ADMIN_LOGIN',
  'ADMIN_LOGOUT',
  'ADMIN_ACCESS_REVOKED',
] as const;
export type AuditAction = (typeof AUDIT_ACTION)[number];

export const PANEL_COMPONENT_TYPE = ['BUTTONS', 'SELECT_MENU'] as const;
export type PanelComponentType = (typeof PANEL_COMPONENT_TYPE)[number];

/** Лимиты и границы значений, используемые при валидации на бэкенде и во фронтенде. */
export const LIMITS = {
  RATING_MIN: 1,
  RATING_MAX: 5,
  CATEGORY_NAME_MAX: 80,
  CATEGORY_DESCRIPTION_MAX: 300,
  WELCOME_MESSAGE_MAX: 2000,
  CLOSE_REASON_MAX: 500,
  MAX_ACTIVE_TICKETS_PER_USER_DEFAULT: 1,
  MAX_ACTIVE_TICKETS_PER_USER_CEILING: 10,
  CHANNEL_NAME_MAX: 90,
  SESSION_TTL_HOURS: 12,
  SESSION_REVALIDATE_MINUTES: 10,
} as const;

/** Discord ограничивает select menu 25 опциями — категорий в одной панели не может быть больше. */
export const MAX_CATEGORIES_PER_PANEL = 25;
