import { useEffect, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { DegradedState, EmptyState, ErrorState, LoadingState } from '../../components/foundation';
import { createApiClient } from '../../lib/api-client';
import { capabilityState, normalizeCapabilities } from '../../lib/capability';
import { readSession } from '../../lib/session';

export default function Plans() {
  const [items, setItems] = useState([]); const [selectedId, setSelectedId] = useState(null);
  const [state, setState] = useState('loading'); const [retry, setRetry] = useState(0); const [capabilities, setCapabilities] = useState(new Set());
  useEffect(() => { let active = true; const api = createApiClient({ getSession: readSession }); setState('loading'); Promise.all([api.get('/benefit-plans'), api.get('/auth/me')]).then(([plans, me]) => { if (!active) return; setItems(plans || []); setCapabilities(normalizeCapabilities(me)); setState('success'); }).catch((error) => { if (!active) return; setState(error?.status === 429 || error?.status === 503 || error?.status === 0 ? 'degraded' : 'error'); }); return () => { active = false; }; }, [retry]);
  const selectionState = capabilityState(capabilities, 'plans.select');
  return <UserShell title="انتخاب طرح"><section className="stack" aria-labelledby="plans-heading"><h2 id="plans-heading">طرح‌های فعال</h2>{state === 'loading' && <LoadingState />}{state === 'degraded' && <><DegradedState>ارتباط با سرویس موقتاً محدود است؛ وضعیت انتخاب جدیدی اعلام نمی‌شود.</DegradedState><button type="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></>}{state === 'error' && <ErrorState title="طرح‌ها قابل دریافت نیستند." onRetry={() => setRetry((value) => value + 1)} />}{state === 'success' && !items.length && <EmptyState title="طرح فعالی وجود ندارد">بعداً دوباره بررسی کنید.</EmptyState>}{state === 'success' && items.length > 0 && <ul className="card-list">{items.map((item) => <li key={item.id} aria-selected={selectedId === item.id}><h3><a href={`/plans/${item.id}`}>{item.name}</a></h3><p>{item.description || 'بدون توضیحات'}</p><p>{item.priceAmount} {item.currency} — اعتبار {item.validityDays} روز</p><button type="button" onClick={() => setSelectedId(item.id)} disabled={selectionState !== 'allowed'} aria-describedby={`plan-${item.id}-status`}>انتخاب طرح</button><p id={`plan-${item.id}-status`} role="status">{selectedId === item.id ? 'این طرح انتخاب شده است؛ ادامه فقط پس از قرارداد backend مجاز است.' : selectionState === 'allowed' ? 'برای انتخاب آماده است.' : 'انتخاب در این محیط تا ارائه capability از backend غیرفعال است.'}</p></li>)}</ul>}</section></UserShell>;
}
