import { Star } from 'lucide-react';

/** Оценка тикета в виде звёзд. Не декоративная — сообщает числовое значение через aria-label. */
export function Rating({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Оценка ${score} из ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={14}
          aria-hidden="true"
          className={i < score ? 'fill-brand text-brand' : 'text-muted'}
        />
      ))}
    </span>
  );
}
