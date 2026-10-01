import { useEffect, useState } from 'react';
import { createApiClient, can } from '../lib/api-client';
import { clearSession, normalizeSessionUser, readSession, writeSession } from '../lib/session';

export function AdminShell({ title, permission, children }) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    const current = readSession();
    if (current) { setSession(current); return; }
    createApiClient().get('/auth/me').then((user) => {
      const hydrated = normalizeSessionUser(user); writeSession(hydrated); setSession(hydrated);
    }).catch(() => { globalThis.location.href = '/login'; });
  }, []);
  if (!session) return <main dir="rtl" lang="fa"><p>در حال بررسی نشست…</p></main>;
  if (permission && !can(session, permission)) return <main dir="rtl" lang="fa"><h1>{title}</h1><p role="alert">دسترسی به این بخش مجاز نیست.</p><a href="/dashboard">بازگشت به داشبورد</a></main>;
  function logout() { clearSession(); globalThis.location.href = '/login'; }
  const links = [['/admin', 'نمای کلی'], ['/admin/reporting', 'گزارش عملیاتی'], ['/admin/wallet-reporting', 'گزارش کیف پول'], ['/admin/eligibility-reporting', 'گزارش Eligibility'], ['/admin/users', 'کاربران'], ['/admin/providers', 'پزشکان'], ['/admin/redemptions', 'استفاده از مزیت'], ['/admin/plans', 'طرح‌ها'], ['/admin/purchases', 'خریدها'], ['/admin/memberships', 'عضویت‌ها'], ['/admin/commissions', 'کمیسیون‌ها'], ['/admin/withdrawals', 'برداشت‌ها'], ['/admin/settings', 'تنظیمات']];
  return <main dir="rtl" lang="fa"><header className="app-header"><a className="brand" href="/admin"><span className="brand-mark brand-mark--admin" aria-hidden="true">ح</span><span><strong>حامی کارت</strong><small>مرکز عملیات</small></span></a><div className="header-account"><span className="account-label">مدیریت سیستم</span><button className="button button--ghost" type="button" onClick={logout}>خروج</button></div></header><div className="app-layout"><aside className="app-sidebar"><p className="nav-heading">مرکز عملیات</p><nav aria-label="ناوبری مدیریت">{links.map(([href, label]) => <a className="nav-link" href={href} key={href}>{label}</a>)}<p className="nav-heading nav-heading--spaced">دسترسی سریع</p><a className="nav-link" href="/dashboard">پنل کاربر</a></nav></aside><section className="app-content"><div className="content-title"><p className="page-eyebrow">مدیریت</p><h1>{title}</h1></div>{children}</section></div></main>;
}

export function useAdminResource(path) { const [data, setData] = useState(null); const [message, setMessage] = useState('در حال بارگذاری…'); const api = createApiClient({ getSession: readSession }); useEffect(() => { api.get(path).then((value) => { setData(value || []); setMessage(''); }).catch((error) => setMessage(error.message)); }, [path]); return { data, message, api, setData, setMessage }; }
