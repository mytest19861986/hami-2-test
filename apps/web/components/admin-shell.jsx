import { useEffect, useState } from 'react';
import { createApiClient, can, revokeCurrentSession } from '../lib/api-client';
import { clearSession, normalizeSessionUser, readSession, writeSession } from '../lib/session';
import { AuthenticatedShell } from './authenticated-shell';

const links = [['/admin', 'نمای کلی'], ['/admin/reporting', 'گزارش عملیاتی'], ['/admin/wallet-reporting', 'گزارش کیف پول'], ['/admin/eligibility-reporting', 'گزارش Eligibility'], ['/admin/users', 'کاربران'], ['/admin/providers', 'پزشکان'], ['/admin/redemptions', 'استفاده از مزیت'], ['/admin/plans', 'طرح‌ها'], ['/admin/purchases', 'خریدها'], ['/admin/refund-cases', 'درخواست‌های تطبیق خرید'], ['/admin/memberships', 'عضویت‌ها'], ['/admin/commissions', 'کمیسیون‌ها'], ['/admin/withdrawals', 'برداشت‌ها'], ['/admin/settings', 'تنظیمات'], ['section', 'دسترسی سریع'], ['/dashboard', 'پنل کاربر']];

export function AdminShell({ title, permission, children }) {
  const [session, setSession] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    const current = readSession();
    if (current) { setSession(current); return; }
    createApiClient().get('/auth/me').then((user) => {
      const hydrated = normalizeSessionUser(user); writeSession(hydrated); setSession(hydrated);
    }).catch(() => { globalThis.location.href = '/login'; });
  }, []);
  if (!session) return <main dir="rtl" lang="fa"><p>در حال بررسی نشست…</p></main>;
  if (permission && !can(session, permission)) return <main dir="rtl" lang="fa"><h1>{title}</h1><p role="alert">دسترسی به این بخش مجاز نیست.</p><a href="/dashboard">بازگشت به داشبورد</a></main>;
  async function logout() { setLogoutError(''); try { await revokeCurrentSession(session); clearSession(); globalThis.location.href = '/login'; } catch { setLogoutError('خروج از نشست سرور تأیید نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.'); } }
  return <AuthenticatedShell area="admin" brandHref="/admin" brandSubtitle="مرکز عملیات" accountLabel="مدیریت سیستم" logout={logout} logoutError={logoutError} links={links} title={title}>{children}</AuthenticatedShell>;
}

export function useAdminResource(path) { const [data, setData] = useState(null); const [message, setMessage] = useState('در حال بارگذاری…'); const api = createApiClient({ getSession: readSession }); useEffect(() => { api.get(path).then((value) => { setData(value || []); setMessage(''); }).catch((error) => setMessage(error.message)); }, [path]); return { data, message, api, setData, setMessage }; }
