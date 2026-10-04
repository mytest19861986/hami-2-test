import { useEffect, useState } from 'react';
import { AdminShell, useAdminResource } from '../../components/admin-shell';
import { labelStatus } from '../../lib/presentation';
import { can } from '../../lib/api-client';
import { readSession } from '../../lib/session';

function DoctorIdentityControls({ provider, api, onMessage }) {
  const [configured, setConfigured] = useState(null); const [nationalId, setNationalId] = useState(''); const [busy, setBusy] = useState(false);
  const session = readSession(); const mayRead = can(session, 'providers.doctor_national_id.read'); const mayManage = can(session, 'providers.doctor_national_id.manage');
  useEffect(() => { if (mayRead && provider.type === 'DOCTOR') api.get(`/admin/providers/${provider.id}/doctor-national-id`).then((result) => setConfigured(result.configured)).catch((error) => onMessage(error.message)); }, [provider.id, provider.type, mayRead]);
  if (provider.type !== 'DOCTOR' || (!mayRead && !mayManage)) return null;
  async function submit(event) { event.preventDefault(); const raw = nationalId; setNationalId(''); setBusy(true); try { const result = await api.put(`/admin/providers/${provider.id}/doctor-national-id`, { nationalId: raw }); setConfigured(result.configured); onMessage('شناسه پزشک به‌شکل امن ثبت شد.'); } catch (error) { onMessage(error.message); } finally { setBusy(false); } }
  return <section className="stack"><p>{mayRead && configured !== null ? `شناسه ملی: ${configured ? 'ثبت شده' : 'ثبت نشده'}` : 'وضعیت شناسه ملی با مجوز مدیریتی قابل مشاهده است.'}</p>{mayManage && <form className="stack" onSubmit={submit}><label htmlFor={`doctor-national-id-${provider.id}`}>ثبت یا تغییر کد ملی پزشک<input id={`doctor-national-id-${provider.id}`} inputMode="numeric" autoComplete="off" maxLength={10} required value={nationalId} onChange={(event) => setNationalId(event.target.value)} /></label><button type="submit" disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت امن شناسه'}</button><small>مقدار خام فقط برای پردازش درخواست استفاده می‌شود؛ پس از ثبت، نمایش داده نمی‌شود. هر تغییر audit می‌شود.</small></form>}</section>;
}

export default function AdminProviders() {
  const { data, message, api, setData, setMessage } = useAdminResource('/admin/providers');
  async function setStatus(id, status) { try { const next = await api.patch(`/admin/providers/${id}/status`, { status }); setData((items) => items.map((item) => item.id === id ? next : item)); } catch (e) { setMessage(e.message); } }
  return <AdminShell title="بررسی پزشکان" permission="providers.read"><p role="status">{message}</p>{data && <ul className="card-list">{data.map((provider) => <li key={provider.id}><h2>{provider.displayName}</h2><p>وضعیت: {labelStatus(provider.status)}</p><p>مکان: {provider.province?.name || '—'}، {provider.city?.name || '—'}</p><p>تخصص: {provider.doctorProfile?.specialty?.name || '—'}</p><DoctorIdentityControls provider={provider} api={api} onMessage={setMessage} />{provider.status === 'PENDING_REVIEW' && <><button type="button" onClick={() => setStatus(provider.id, 'APPROVED')}>تأیید</button><button type="button" onClick={() => setStatus(provider.id, 'REJECTED')}>رد</button></>}{provider.status === 'APPROVED' && <button type="button" onClick={() => setStatus(provider.id, 'SUSPENDED')}>تعلیق</button>}{provider.status === 'REJECTED' && <button type="button" onClick={() => setStatus(provider.id, 'DRAFT')}>بازگشت به پیش‌نویس</button>}{provider.status === 'SUSPENDED' && <button type="button" onClick={() => setStatus(provider.id, 'DRAFT')}>بازگشت به پیش‌نویس</button>}</li>)}</ul>}</AdminShell>;
}
