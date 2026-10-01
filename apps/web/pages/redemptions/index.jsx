import { useEffect, useMemo, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, Stack } from '../../components/foundation';
import { createApiClient } from '../../lib/api-client';
import { labelStatus } from '../../lib/presentation';
import { readSession } from '../../lib/session';

const tone = { INITIATED: 'warning', CONFIRMED: 'success', CANCELLED: 'neutral', EXPIRED: 'neutral', REVERSED: 'danger' };
export default function Redemptions() {
  const api = useMemo(() => createApiClient({ getSession: readSession }), []);
  const [rows, setRows] = useState(null); const [message, setMessage] = useState('در حال بارگذاری…'); const [error, setError] = useState(false);
  useEffect(() => { api.get('/users/me/redemptions').then((value) => { setRows(value || []); setMessage(''); }).catch((e) => { setMessage(e.message); setError(true); }); }, [api]);
  async function cancel(id) { try { const next = await api.post(`/redemptions/${id}/cancel`, {}); setRows((current) => current.map((row) => row.id === id ? next : row)); } catch (e) { setMessage(e.message); } }
  return <UserShell title="استفاده از مزیت"><Stack><PageHeader eyebrow="مزیت‌های استفاده‌شده" title="تاریخچه استفاده" description="کدهای تأیید فقط در لحظه ایجاد نمایش داده می‌شوند و بعداً قابل بازیابی نیستند." />{message && (error ? <ErrorState title={message} onRetry={() => globalThis.location.reload()} /> : <LoadingState label={message} />)}{rows && !rows.length && <EmptyState title="هنوز استفاده‌ای ثبت نشده است">از صفحه جزئیات پزشک، واجدشرایط‌بودن خود را بررسی کنید.</EmptyState>}{rows && rows.map((row) => <Card key={row.id}><div className="provider-card-head"><h2>{row.benefitSnapshot?.providerName || 'پزشک یا مرکز'}</h2><StatusBadge tone={tone[row.status] || 'neutral'}>{labelStatus(row.status)}</StatusBadge></div><p>{row.benefitSnapshot?.planName || 'مزیت سلامت'} · {row.createdAt ? new Date(row.createdAt).toLocaleString('fa-IR') : '—'}</p>{row.confirmedAt && <p>تأییدشده در: {new Date(row.confirmedAt).toLocaleString('fa-IR')}</p>}{row.status === 'INITIATED' && <button className="button button--ghost" type="button" onClick={() => cancel(row.id)}>لغو درخواست</button>}</Card>)}</Stack></UserShell>;
}
