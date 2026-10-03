import { useEffect, useState } from 'react';
import { UserShell } from '../components/user-shell';
import { createApiClient } from '../lib/api-client';
import { readSession } from '../lib/session';
import { formatMoney } from '../lib/presentation';

const SUMMARY_FIELDS = ['pending_balance', 'available_balance', 'clawback_due', 'lifetime_earned', 'monthly_type_aggregates', 'plan_label'];

function State({ kind, title, children, onRetry }) {
  return <section className={`ui-state ui-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <h2>{title}</h2><p>{children}</p>{onRetry && <button type="button" onClick={onRetry}>تلاش دوباره</button>}
  </section>;
}

function Summary({ data }) {
  const labels = { pending_balance: 'در انتظار', available_balance: 'قابل دسترس', clawback_due: 'مبلغ برگشت‌خورده', lifetime_earned: 'مجموع درآمد' };
  return <section className="ui-card" aria-labelledby="commission-summary-heading">
    <h2 id="commission-summary-heading">خلاصه کمیسیون</h2>
    <p>داده‌ها مستقیماً از قرارداد خواندن سرور ارائه می‌شوند؛ محاسبه‌ای در مرورگر انجام نمی‌شود.</p>
    <dl className="commission-summary-grid">
      {Object.entries(labels).map(([field, label]) => <div key={field}><dt>{label}</dt><dd dir="ltr">{formatMoney(data[field] ?? 0, data.currency_code || 'IRR')}</dd></div>)}
    </dl>
    {data.plan_label && <p>طرح: {data.plan_label}</p>}
  </section>;
}

export default function CommissionOverview() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const api = createApiClient({ getSession: readSession });

  useEffect(() => {
    let active = true;
    setState('loading');
    api.get('/rep/commission/summary').then((payload) => {
      if (!active) return;
      const safe = Object.fromEntries(SUMMARY_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(payload || {}, field)).map((field) => [field, payload[field]]));
      setData(safe); setState('success');
    }).catch((error) => {
      if (!active) return;
      setData(null);
      setState(error.status === 403 ? 'unauthorized' : error.status === 404 || error.status === 503 ? 'degraded' : 'error');
    });
    return () => { active = false; };
  }, [attempt]);

  return <UserShell title="خلاصه کمیسیون"><div className="ui-stack">
    {state === 'loading' && <State kind="loading" title="در حال بارگذاری">در حال دریافت خلاصه کمیسیون هستیم.</State>}
    {state === 'unauthorized' && <State kind="error" title="دسترسی مجاز نیست">دسترسی به این بخش مجاز نیست.</State>}
    {state === 'degraded' && <State kind="degraded" title="خلاصه کمیسیون موقتاً در دسترس نیست">داده مالی stale یا placeholder نمایش داده نمی‌شود.</State>}
    {state === 'error' && <State kind="error" title="خطا در دریافت اطلاعات" onRetry={() => setAttempt((value) => value + 1)}>اطلاعات خلاصه کمیسیون قابل دریافت نیست.</State>}
    {state === 'success' && (!data || Object.keys(data).length === 0 ? <State kind="empty" title="داده‌ای ثبت نشده است">خلاصه کمیسیون در حال حاضر صفر یا خالی است.</State> : <Summary data={data} />)}
  </div></UserShell>;
}
