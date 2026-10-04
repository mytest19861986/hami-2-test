import { useEffect, useState } from 'react';
import { createApiClient, can, revokeCurrentSession } from '../lib/api-client';
import { clearSession, normalizeSessionUser, readSession, writeSession } from '../lib/session';
import { AuthenticatedShell } from './authenticated-shell';

const links = [
  ['/support', 'نمای کلی پشتیبانی', 'support.dashboard.read'],
  ['#users', 'کاربران', 'support.users.read'],
  ['#providers', 'ارائه‌دهندگان', 'support.providers.read'],
  ['#purchases', 'خریدها', 'support.purchases.read'],
  ['#memberships', 'عضویت‌ها', 'support.memberships.read'],
  ['#redemptions', 'سوابق استفاده', 'support.redemptions.read'],
  ['#refund-cases', 'پرونده‌های بازپرداخت', 'support.refund_cases.read'],
];

export function SupportShell({ title, children }) {
  const [session, setSession] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    const current = readSession();
    if (current) { setSession(current); return; }
    createApiClient().get('/auth/me').then((user) => { const hydrated = normalizeSessionUser(user); writeSession(hydrated); setSession(hydrated); }).catch(() => { globalThis.location.href = '/login'; });
  }, []);
  if (!session) return <main dir="rtl" lang="fa"><p role="status">در حال بررسی نشست…</p></main>;
  if (!session.roles.includes('SUPPORT') || !can(session, 'support.dashboard.read')) return <main dir="rtl" lang="fa"><h1>پنل پشتیبانی</h1><p role="alert">دسترسی به این بخش مجاز نیست.</p><a href="/dashboard">بازگشت</a></main>;
  async function logout() { setLogoutError(''); try { await revokeCurrentSession(session); clearSession(); globalThis.location.href = '/login'; } catch { setLogoutError('خروج از نشست سرور تأیید نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.'); } }
  const visibleLinks = links.filter(([, , permission]) => can(session, permission));
  return <AuthenticatedShell area="support" brandHref="/support" brandSubtitle="پشتیبانی امن و محدود" accountLabel="کارشناس پشتیبانی" logout={logout} logoutError={logoutError} links={visibleLinks} title={title}>{children}</AuthenticatedShell>;
}
