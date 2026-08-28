import { NextResponse } from 'next/server';
import { botApi, InternalApiError } from '@/lib/internalApi';
import { guardMutation, isSession } from '@/lib/apiGuard';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  try {
    const result = await botApi.publishPanel(id);
    await writeAuditLog({
      action: 'PANEL_PUBLISHED',
      actorId: guard.discordUserId,
      targetType: 'PANEL',
      targetId: id,
      notifyDiscord: false,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof InternalApiError ? error.message : 'Не удалось опубликовать панель';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
