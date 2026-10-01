import { useEffect, useState } from 'react';
import { UserShell } from '../components/user-shell';
import { ErrorState, LoadingState } from '../components/foundation';
import { createApiClient } from '../lib/api-client';
import { readSession } from '../lib/session';

function maskNationalId(value) { const raw = String(value || ''); return raw ? `${'*'.repeat(Math.max(0, raw.length - 2))}${raw.slice(-2)}` : 'ثبت نشده'; }

export default function Profile() {
  const [form, setForm] = useState({ firstName: '', lastName: '', birthDate: '' }); const [nationalId, setNationalId] = useState(''); const [state, setState] = useState('loading'); const [message, setMessage] = useState(''); const [retry, setRetry] = useState(0); const api = createApiClient({ getSession: readSession });
  useEffect(() => { let active = true; setState('loading'); api.get('/users/me/profile').then((data) => { if (!active) return; setForm({ firstName: data?.firstName || '', lastName: data?.lastName || '', birthDate: data?.birthDate?.slice?.(0, 10) || '' }); setNationalId(data?.nationalId || ''); setState('success'); }).catch(() => { if (active) setState('error'); }); return () => { active = false; }; }, [retry]);
  // Logout remains centralized in UserShell (auth/logout); this page only edits permitted profile fields.
  async function save(event) { event.preventDefault(); setMessage('در حال ذخیره…'); try { await api.put('/users/me/profile', form); setMessage('پروفایل ذخیره شد.'); } catch (error) { setMessage(error.message); } }
  return <UserShell title="پروفایل و تنظیمات حساب"><section className="stack" aria-labelledby="profile-heading"><h2 id="profile-heading">اطلاعات حساب</h2>{state === 'loading' && <LoadingState />}{state === 'error' && <ErrorState title="اطلاعات حساب قابل دریافت نیست." onRetry={() => setRetry((value) => value + 1)} />}{state === 'success' && <><form onSubmit={save}><label htmlFor="first-name">نام<input id="first-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label htmlFor="last-name">نام خانوادگی<input id="last-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label><label htmlFor="birth-date">تاریخ تولد<input id="birth-date" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label><button type="submit">ذخیره اطلاعات مجاز</button><p aria-live="polite">{message}</p></form><section className="card" aria-labelledby="identity-heading"><h3 id="identity-heading">شناسه هویتی</h3><p>کد ملی: <bdi dir="ltr">{maskNationalId(nationalId)}</bdi></p><small>اطلاعات حساس فقط به‌صورت محدود نمایش داده می‌شود و از این صفحه قابل تغییر نیست.</small></section></>}</section></UserShell>;
}
