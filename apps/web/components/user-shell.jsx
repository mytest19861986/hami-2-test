import { useEffect, useState } from 'react';
import { createApiClient } from '../lib/api-client';
import { clearSession, readSession } from '../lib/session';

export function UserShell({ title, children }) {
  const [session, setSession] = useState(null);
  useEffect(() => { const current = readSession(); if (!current) { globalThis.location.href = '/login'; return; } setSession(current); }, []);
  async function logout() { try { await createApiClient({ getSession: () => session }).post('/auth/logout', session?.sessionId ? { sessionId: session.sessionId } : {}); } catch { /* local logout remains safe */ } clearSession(); globalThis.location.href = '/login'; }
  if (!session) return <main dir="rtl" lang="fa"><p>در حال بررسی نشست…</p></main>;
  return <main dir="rtl" lang="fa"><header><h1>{title}</h1><nav aria-label="ناوبری کاربر"><a href="/dashboard">داشبورد</a> <a href="/rep-dashboard">داشبورد همکار</a> <a href="/attributed-customers">مشتریان منتسب</a> <a href="/commission-overview">خلاصه کمیسیون</a> <a href="/providers">پزشکان</a> <a href="/providers/me">وضعیت همکاری پزشک</a> <a href="/plans">طرح‌ها</a> <a href="/purchases">خریدها</a> <a href="/memberships">عضویت‌ها</a> <a href="/wallet">کیف پول</a> <a href="/referrals">معرفی دوستان</a> <a href="/sales">همکار فروش</a> <a href="/profile">پروفایل</a> <a href="/addresses">آدرس‌ها</a> <button type="button" onClick={logout}>خروج</button></nav></header>{children}</main>;
}
