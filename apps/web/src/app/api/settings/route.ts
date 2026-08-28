import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { guildSettingsInputSchema } from '@twomcsu/shared';
import { env } from '@/env';
import { guardMutation, guardRead, isSession } from '@/lib/apiGuard';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;

  const settings = await prisma.guildSettings.upsert({
    where: { guildId: env.DISCORD_GUILD_ID },
    update: {},
    create: { guildId: env.DISCORD_GUILD_ID },
  });
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;

  const parsed = guildSettingsInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const settings = await prisma.guildSettings.update({
    where: { guildId: env.DISCORD_GUILD_ID },
    data: parsed.data,
  });

  await writeAuditLog({
    action: 'SETTINGS_UPDATED',
    actorId: guard.discordUserId,
    targetType: 'SETTINGS',
  });

  return NextResponse.json(settings);
}
