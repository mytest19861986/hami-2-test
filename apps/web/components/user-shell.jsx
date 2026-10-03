import { useEffect, useState } from 'react';
import { createApiClient, revokeCurrentSession } from '../lib/api-client';
import { clearSession, normalizeSessionUser, readSession, writeSession } from '../lib/session';
import { AuthenticatedShell } from './authenticated-shell';

const links = [
  ['/dashboard', 'داشبورد'], ['/providers', 'پزشکان و مراکز'], ['/redemptions', 'استفاده از مزیت'],
  ['/plans', 'طرح‌ها'], ['/purchases', 'خریدهای من'], ['/memberships', 'عضویت‌ها'], ['/wallet', 'کیف پول'],
  ['section', 'همکاری و حساب'], ['/providers/onboarding', 'درخواست همکاری پزشک'], ['/providers/me', 'وضعیت همکاری پزشک'],
  ['/providers/redemptions', 'تأیید استفاده'], ['/rep-dashboard', 'داشبورد همکار'], ['/attributed-customers', 'مشتریان منتسب'],
  ['/commission-overview', 'خلاصه کمیسیون'], ['/referrals', 'معرفی دوستان'], ['/sales', 'همکار فروش'], ['/profile', 'پروفایل'], ['/addresses', 'آدرس‌ها'],
];

export function UserShell({ title, children }) {
  const [session, setSession] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => { const current = readSession(); if (current) { setSession(current); return; } createApiClient().get('/auth/me').then((user) => { const hydrated = normalizeSessionUser(user); writeSession(hydrated); setSession(hydrated); }).catch(() => { globalThis.location.href = '/login'; }); }, []);
  async function logout() { setLogoutError(''); try { await revokeCurrentSession(session); clearSession(); globalThis.location.href = '/login'; } catch { setLogoutError('خروج از نشست سرور تأیید نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.'); } }
  if (!session) return <main dir="rtl" lang="fa"><p>در حال بررسی نشست…</p></main>;
  return <AuthenticatedShell area="user" brandHref="/dashboard" brandSubtitle="سلامت، ساده و مطمئن" accountLabel="حساب کاربری" logout={logout} logoutError={logoutError} links={links} title={title}>{children}</AuthenticatedShell>;
}
