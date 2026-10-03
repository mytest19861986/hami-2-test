import { useEffect, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { DegradedState, EmptyState, ErrorState, LoadingState } from '../../components/foundation';
import { createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';
import { formatMoney, labelStatus } from '../../lib/presentation';

export default function Purchases() {
  const [items, setItems] = useState([]); const [state, setState] = useState('loading'); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; const api = createApiClient({ getSession: readSession }); setState('loading'); api.get('/users/me/purchases').then((rows) => { if (!active) return; setItems(rows || []); setState('success'); }).catch((error) => { if (!active) return; setState(error?.status === 429 || error?.status === 503 || error?.status === 0 ? 'degraded' : 'error'); }); return () => { active = false; }; }, [retry]);
  return <UserShell title="خریدهای من"><section className="stack" aria-labelledby="purchases-heading"><h2 id="purchases-heading">طرح‌های خریداری‌شده</h2>{state === 'loading' && <LoadingState />}{state === 'degraded' && <><DegradedState>ارتباط با سرویس موقتاً محدود است؛ وضعیت خریدها تغییر داده نمی‌شود.</DegradedState><button type="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></>}{state === 'error' && <ErrorState title="سابقه خرید قابل دریافت نیست." onRetry={() => setRetry((value) => value + 1)} />}{state === 'success' && !items.length && <EmptyState title="هنوز خریدی ثبت نشده است">طرح‌های خریداری‌شده پس از ثبت backend اینجا نمایش داده می‌شوند.</EmptyState>}{state === 'success' && items.length > 0 && <ul className="card-list">{items.map((item) => <li key={item.id}><h3><a href={`/purchases/${item.id}`}>خرید {item.id}</a></h3><p>مبلغ ثبت‌شده: {formatMoney(item.amountSnapshot, item.currencySnapshot)}</p><p>وضعیت پرداخت: {labelStatus(item.status)}</p><p>وضعیت فعال‌سازی: {labelStatus(item.activationStatus)}</p><p>تاریخ خرید: {new Date(item.createdAt).toLocaleDateString('fa-IR')}</p><p>اعتبار ثبت‌شده: {item.validityDaysSnapshot} روز</p></li>)}</ul>}</section></UserShell>;
}
