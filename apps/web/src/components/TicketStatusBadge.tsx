import { Circle, CircleCheck, Lock } from 'lucide-react';

const STATUS_CONFIG = {
  OPEN: { label: 'Открыт', icon: Circle, className: 'badge-success' },
  CLAIMED: { label: 'В работе', icon: CircleCheck, className: 'badge-warning' },
  CLOSED: { label: 'Закрыт', icon: Lock, className: 'badge-danger' },
} as const;

export function TicketStatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`badge ${config.className}`}>
      <Icon size={12} aria-hidden="true" />
      {config.label}
    </span>
  );
}
