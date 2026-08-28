import { describe, expect, it } from 'vitest';
import type { TicketCategory } from '@twomcsu/db';
import { requireSupportAccess } from './ticketService.js';

function fakeCategory(supportRoleIds: string[]): TicketCategory {
  return { supportRoleIds } as TicketCategory;
}

function fakeMember(roleIds: string[], isAdmin = false) {
  return {
    permissions: { has: () => isAdmin },
    roles: { cache: new Map(roleIds.map((id) => [id, true])) },
  };
}

describe('requireSupportAccess', () => {
  it('пропускает администратора сервера независимо от ролей', () => {
    const category = fakeCategory(['role-support']);
    expect(requireSupportAccess(category, fakeMember([], true))).toBe(true);
  });

  it('пропускает участника с одной из ролей поддержки', () => {
    const category = fakeCategory(['role-a', 'role-b']);
    expect(requireSupportAccess(category, fakeMember(['role-b']))).toBe(true);
  });

  it('отклоняет участника без нужных ролей и без прав администратора', () => {
    const category = fakeCategory(['role-a', 'role-b']);
    expect(requireSupportAccess(category, fakeMember(['role-c']))).toBe(false);
  });

  it('отклоняет, если у категории нет ролей поддержки, а участник не администратор', () => {
    const category = fakeCategory([]);
    expect(requireSupportAccess(category, fakeMember(['role-c']))).toBe(false);
  });
});
