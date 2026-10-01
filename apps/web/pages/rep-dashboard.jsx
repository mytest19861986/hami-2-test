import { useEffect, useState } from 'react';
import { UserShell } from '../components/user-shell';
import { Card, ErrorState, LoadingState, Stack } from '../components/foundation';
import { createApiClient } from '../lib/api-client';
import { readSession } from '../lib/session';
import { formatMoney, labelStatus } from '../lib/presentation';

const PERIODS = [['7d', '۷ روز'], ['30d', '۳۰ روز'], ['all', 'همه']];
const COMMISSION_STATES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVERSED'];

function CommissionGroups({ groups }) {
  if (!groups.length) return <p>برای این بازه داده کمیسیون وجود ندارد.</p>;
  return <div className="dashboard-grid">{groups.map((group) => <Card key={group.currency_code} title={`کمیسیون ${group.currency_code}`}><ul className="card-list">{COMMISSION_STATES.map((state) => <li key={state}><strong>{labelStatus(state)}</strong><span dir="ltr">{formatMoney(group.states[state].amount_minor, group.currency_code)}</span></li>)}</ul></Card>)}</div>;
}

export default function RepresentativeDashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState(null); const [period, setPeriod] = useState('all');
  async function load(nextPeriod = period) { setError(null); setData(null); try { setData((await createApiClient({ getSession: readSession }).get(`/rep/reporting/summary?period=${nextPeriod}`)).reporting); } catch (reason) { setError(reason); } }
  useEffect(() => { load(); }, []);
  return <UserShell title="گزارش‌دهی همکار فروش"><Stack>{!data && !error && <LoadingState />}{error && <ErrorState title={error.status === 403 ? 'دسترسی به این بخش مجاز نیست.' : 'گزارش همکار فروش قابل دریافت نیست.'} onRetry={() => load()} />}{data && <><nav aria-label="فیلتر بازه زمانی">{PERIODS.map(([value, text]) => <button key={value} type="button" onClick={() => { setPeriod(value); load(value); }}>{text}</button>)}</nav><div className="dashboard-grid"><Card title="انتساب‌های فعال"><p className="dashboard-balance">{data.attribution.active_count}</p><p>ایجادشده در بازه: {data.attribution.created_count}</p><a href="/attributed-customers">مشاهده انتساب‌ها</a></Card><Card title="فعالیت خرید"><p>ایجادشده: {data.purchases.created_count}</p><p>پرداخت‌شده: {data.purchases.paid_count}</p><small>زمان ایجاد: {data.purchases.created_timestamp} — زمان پرداخت: {data.purchases.paid_timestamp}</small></Card></div><CommissionGroups groups={data.commissions.currency_groups} /><Card title="شاخص‌های تعریف‌نشده"><p>Active Customer، Membership Activation و Paid Commission در Contract فعلی تعریف نشده‌اند و عدد صفر جعلی نمایش داده نمی‌شود.</p></Card></>}</Stack></UserShell>;
}
