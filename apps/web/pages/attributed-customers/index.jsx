import { useEffect, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { DegradedState, EmptyState, ErrorState, LoadingState } from '../../components/foundation';
import { ApiError, createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';

export default function AttributedCustomers() {
  const [state, setState] = useState('loading');
  const [rows, setRows] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [retryAfterMs, setRetryAfterMs] = useState(null);
  useEffect(() => {
    let active = true;
    const api = createApiClient({ getSession: readSession });
    setState('loading');
    api.get('/sales-partner/customers').then((items) => {
      if (!active) return;
      setRows(Array.isArray(items) ? items : []); setState('success'); setRetryAfterMs(null);
    }).catch((error) => {
      if (!active) return;
      setRetryAfterMs(error?.retryAfterMs ?? null);
      setState(error instanceof ApiError && (error.status === 429 || error.status === 503 || error.status === 0) ? 'degraded' : error?.status === 403 ? 'unauthorized' : 'error');
    });
    return () => { active = false; };
  }, [attempt]);
  return <UserShell title="مشتریان منتسب"><section className="stack" aria-labelledby="attributed-customers-heading"><h2 id="attributed-customers-heading">مشتریان معرفی‌شده</h2>
    {state === 'loading' && <LoadingState />}
    {state === 'degraded' && <><DegradedState retryAfterMs={retryAfterMs}>ارتباط با سرویس موقتاً محدود است؛ دادهٔ جدیدی نمایش داده نمی‌شود.</DegradedState><button type="button" onClick={() => setAttempt((value) => value + 1)}>تلاش دوباره</button></>}
    {state === 'unauthorized' && <ErrorState title="دسترسی به این بخش مجاز نیست." />}
    {state === 'error' && <ErrorState title="فهرست مشتریان قابل دریافت نیست." onRetry={() => setAttempt((value) => value + 1)} />}
    {state === 'success' && !rows.length && <EmptyState title="مشتری منتسبی وجود ندارد">در صورت ثبت attribution، مشتریان اینجا نمایش داده می‌شوند.</EmptyState>}
    {state === 'success' && rows.length > 0 && <ul className="card-list">{rows.map((row) => <li key={row.id}><h3>{row.displayAlias}</h3><p dir="ltr">{row.customerRef}</p><p>وضعیت انتساب: {row.status === 'ACTIVE' ? 'فعال' : row.status}</p><p>وضعیت مشتری: {row.customerStatus || 'نامشخص'}</p>{row.latestPlanName && <p>آخرین طرح: {row.latestPlanName} ({row.latestPurchaseStatus})</p>}<small>{new Date(row.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })}</small></li>)}</ul>}
    <p role="note">اطلاعات تماس، شناسهٔ خام و دادهٔ مالی مشتری نمایش داده نمی‌شود.</p>
  </section></UserShell>;
}
