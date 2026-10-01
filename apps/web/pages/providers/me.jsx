import { useEffect, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { labelStatus } from '../../lib/presentation';
import { createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';

// Provider states (DRAFT, PENDING_REVIEW, APPROVED, REJECTED, SUSPENDED) use the shared presentation mapping.

export default function MyProviderStatus() {
  const [items, setItems] = useState(null); const [message, setMessage] = useState('در حال بارگذاری…');
  const api = createApiClient({ getSession: readSession });
  useEffect(() => { api.get('/users/me/providers').then((rows) => { setItems(rows || []); setMessage(''); }).catch((error) => setMessage(error.message)); }, []);
  return <UserShell title="وضعیت همکاری پزشک"><section className="stack"><p role="status">{message}</p>{items && !items.length && <p>برای این حساب هنوز پروندهٔ پزشک ثبت نشده است.</p>} {items && items.map((item) => <article className="card" key={item.id}><h2>{item.displayName}</h2><p>وضعیت بررسی: {labelStatus(item.status)}</p><p>استان: {item.province?.name || '—'}، شهر: {item.city?.name || '—'}</p><p>تخصص: {item.doctorProfile?.specialty?.name || '—'}</p><p>وضعیت فعال‌سازی: {item.status === 'APPROVED' ? 'فعال' : 'فعال نیست'}</p><small>این صفحه فقط اطلاعات پروندهٔ منتسب به نشست فعلی را نمایش می‌دهد.</small></article>)}</section></UserShell>;
}
