import { useMemo, useState } from 'react';
import { AdminShell, useAdminResource } from '../../components/admin-shell';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, Stack } from '../../components/foundation';
import { labelStatus } from '../../lib/presentation';
import { createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';

export default function AdminRedemptions() {
  const { data, message, setData, setMessage } = useAdminResource('/admin/redemptions'); const api = useMemo(() => createApiClient({ getSession: readSession }), []); const [reason, setReason] = useState({});
  async function reverse(id) { if (!reason[id]?.trim()) { setMessage('برای برگشت، ثبت دلیل الزامی است.'); return; } try { const row = await api.post(`/admin/redemptions/${id}/reverse`, { reason: reason[id] }); setData((current) => current.map((item) => item.id === id ? row : item)); } catch (e) { setMessage(e.message); } }
  return <AdminShell title="مدیریت استفاده از مزیت" permission="redemptions.reverse"><Stack><PageHeader eyebrow="مرکز عملیات" title="Redemptionها" description="اطلاعات نمایش‌داده‌شده محدود به داده‌های امن عملیاتی است." />{message && (data ? <p role="status">{message}</p> : <LoadingState label={message} />)}{data && !data.length && <EmptyState title="Redemptionای ثبت نشده است" />}{data && data.map((row) => <Card key={row.id}><div className="provider-card-head"><h2>{row.benefitSnapshot?.providerName || 'ارائه‌دهنده'}</h2><StatusBadge tone={row.status === 'CONFIRMED' ? 'success' : 'neutral'}>{labelStatus(row.status)}</StatusBadge></div><p>{row.benefitSnapshot?.planName || 'مزیت سلامت'} · {row.createdAt ? new Date(row.createdAt).toLocaleString('fa-IR') : '—'}</p>{row.status === 'CONFIRMED' && <><label htmlFor={`reason-${row.id}`}>دلیل برگشت</label><input id={`reason-${row.id}`} value={reason[row.id] || ''} onChange={(e) => setReason((current) => ({ ...current, [row.id]: e.target.value }))} /><button className="button" type="button" onClick={() => reverse(row.id)}>برگشت Redemption</button></>}</Card>)}</Stack></AdminShell>;
}
