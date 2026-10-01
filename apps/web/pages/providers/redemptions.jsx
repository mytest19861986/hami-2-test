import { useEffect, useMemo, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, Stack } from '../../components/foundation';
import { createApiClient } from '../../lib/api-client';
import { labelStatus } from '../../lib/presentation';
import { readSession } from '../../lib/session';

export default function ProviderRedemptions() {
  const api = useMemo(() => createApiClient({ getSession: readSession }), []); const [rows, setRows] = useState(null); const [token, setToken] = useState(''); const [message, setMessage] = useState('در حال بارگذاری…'); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/providers/me/redemptions').then((value) => { setRows(value || []); setMessage(''); }).catch((e) => { setMessage(e.message); setError(true); }); }, [api]);
  async function confirm(event) { event.preventDefault(); if (!token.trim()) return; setBusy(true); try { const row = await api.post('/providers/me/redemptions/confirm', { token: token.trim() }); setRows((current) => [row, ...(current || []).filter((item) => item.id !== row.id)]); setToken(''); setMessage('کد با موفقیت تأیید شد.'); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  return <UserShell title="تأیید استفاده"><Stack><PageHeader eyebrow="فضای ارائه‌دهنده" title="تأیید کد استفاده" description="فقط کدهای مربوط به ارائه‌دهنده‌ی فعلی قابل تأیید هستند." /><Card><form onSubmit={confirm}><label htmlFor="verification-code">کد یک‌بارمصرف</label><input id="verification-code" inputMode="text" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} aria-describedby="code-help" /><p id="code-help">کد را از مشتری دریافت کنید؛ کد خام ذخیره یا در تاریخچه نمایش داده نمی‌شود.</p><button className="button" type="submit" disabled={busy || !token.trim()}>تأیید کد</button></form></Card><p role={error ? 'alert' : 'status'}>{message}</p>{rows && !rows.length && <EmptyState title="درخواستی برای این ارائه‌دهنده وجود ندارد" />}{rows && rows.map((row) => <Card key={row.id}><div className="provider-card-head"><h2>{row.benefitSnapshot?.planName || 'مزیت سلامت'}</h2><StatusBadge tone={row.status === 'CONFIRMED' ? 'success' : 'neutral'}>{labelStatus(row.status)}</StatusBadge></div><p>{row.benefitSnapshot?.providerName || '—'} · {row.createdAt ? new Date(row.createdAt).toLocaleString('fa-IR') : '—'}</p></Card>)}</Stack></UserShell>;
}
