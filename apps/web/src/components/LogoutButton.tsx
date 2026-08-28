'use client';

export function LogoutButton() {
  async function handleLogout() {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('twomcsu_csrf='))
      ?.split('=')[1];

    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken ?? '' },
    });
    window.location.href = '/login';
  }

  return (
    <button onClick={handleLogout} className="btn-secondary w-full text-sm">
      Выйти
    </button>
  );
}
