import { useEffect, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { DegradedState, EmptyState, ErrorState, LoadingState } from '../../components/foundation';
import { createApiClient } from '../../lib/api-client';
import { capabilityState, normalizeCapabilities } from '../../lib/capability';
import { readSession } from '../../lib/session';

export default function Plans() {
  const [items, setItems] = useState([]); const [purchasingId, setPurchasingId] = useState(null); const [purchaseError, setPurchaseError] = useState('');
  const [state, setState] = useState('loading'); const [retry, setRetry] = useState(0); const [capabilities, setCapabilities] = useState(new Set());
  useEffect(() => { let active = true; const api = createApiClient({ getSession: readSession }); setState('loading'); Promise.all([api.get('/benefit-plans'), api.get('/auth/me')]).then(([plans, me]) => { if (!active) return; setItems(plans || []); setCapabilities(normalizeCapabilities(me)); setState('success'); }).catch((error) => { if (!active) return; setState(error?.status === 429 || error?.status === 503 || error?.status === 0 ? 'degraded' : 'error'); }); return () => { active = false; }; }, [retry]);
  async function purchase(item) {
    setPurchasingId(item.id); setPurchaseError('');
    try {
      const row = await createApiClient({ getSession: readSession }).post('/users/me/purchases', { planId: item.id });
      if (!row?.id) throw new Error('خرید ایجاد نشد؛ لطفاً دوباره تلاش کنید.');
      globalThis.location.href = `/purchases/${row.id}`;
    } catch (error) {
      setPurchaseError(error.status === 403 ? 'اجازهٔ خرید این طرح برای این حساب وجود ندارد.' : error.message || 'ایجاد خرید ناموفق بود.');
      setPurchasingId(null);
    }
  }
  const selectionState = capabilityState(capabilities, 'plans.select');
  return <UserShell title="انتخاب طرح"><section className="stack" aria-labelledby="plans-heading"><h2 id="plans-heading">طرح‌های فعال</h2>{state === 'loading' && <LoadingState />}{state === 'degraded' && <><DegradedState>ارتباط با سرویس موقتاً محدود است؛ وضعیت انتخاب جدیدی اعلام نمی‌شود.</DegradedState><button type="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></>}{state === 'error' && <ErrorState title="طرح‌ها قابل دریافت نیستند." onRetry={() => setRetry((value) => value + 1)} />}{state === 'success' && !items.length && <EmptyState title="طرح فعالی وجود ندارد">بعداً دوباره بررسی کنید.</EmptyState>}{purchaseError && <p role="alert">{purchaseError}</p>}{state === 'success' && items.length > 0 && <ul className="card-list">{items.map((item) => <li key={item.id}><h3><a href={`/plans/${item.id}`}>{item.name}</a></h3><p>{item.description || 'بدون توضیحات'}</p><p>{item.priceAmount} {item.currency} — اعتبار {item.validityDays} روز</p><button type="button" onClick={() => purchase(item)} disabled={selectionState !== 'allowed' || purchasingId !== null} aria-describedby={`plan-${item.id}-status`}>{purchasingId === item.id ? 'در حال ایجاد خرید…' : 'خرید طرح'}</button><p id={`plan-${item.id}-status`} role="status">{purchasingId === item.id ? 'در حال ثبت خرید؛ پرداخت و فعال‌سازی انجام نمی‌شود.' : selectionState === 'allowed' ? 'خرید فقط یک درخواست پرداخت ایجاد می‌کند؛ پرداخت و فعال‌سازی در این مرحله انجام نمی‌شوند.' : 'خرید برای این حساب مجاز نیست.'}</p></li>)}</ul>}</section></UserShell>;
}
