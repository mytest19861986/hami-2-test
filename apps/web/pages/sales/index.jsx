import { useEffect, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';

export default function Sales() {
  const [rows, setRows] = useState([]); const [customerUserId, setCustomerUserId] = useState(''); const [message, setMessage] = useState('در حال بارگذاری…'); const [busy, setBusy] = useState(false); const api = createApiClient({ getSession: readSession });
  async function load() { try { setRows(await api.get('/sales-partner/customers') || []); setMessage(''); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, []);
  async function submit(event) { event.preventDefault(); if (!customerUserId.trim()) { setMessage('شناسه مشتری را وارد کنید.'); return; } setBusy(true); try { await api.post('/sales-partner/customers', { customerUserId: customerUserId.trim() }); setCustomerUserId(''); await load(); setMessage('مشتری به attribution همکار فروش اضافه شد.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <UserShell title="پنل همکار فروش"><p role="status" aria-live="polite">{message}</p><section className="card"><h2>ثبت مشتری</h2><p>این فرم فقط از قرارداد واقعی attribution استفاده می‌کند.</p><form onSubmit={submit}><label htmlFor="customer-user-id">شناسه کاربر مشتری</label><input id="customer-user-id" value={customerUserId} onChange={(event) => setCustomerUserId(event.target.value)} /><button type="submit" disabled={busy}>ثبت attribution</button></form></section><section><h2>مشتریان منتسب</h2>{!rows.length ? <p>مشتری منتسبی ثبت نشده است.</p> : <ul className="card-list">{rows.map((row) => <li key={row.id}><p>شناسه مشتری: {row.customerUserId}</p><p>وضعیت: {row.status || 'فعال'}</p><small>{new Date(row.createdAt).toLocaleString('fa-IR')}</small></li>)}</ul>}</section><section className="card"><h2>کمیسیون</h2><p>API کاربر برای فهرست کمیسیون وجود ندارد؛ داده یا محاسبه ساختگی نمایش داده نمی‌شود.</p></section></UserShell>;
}
