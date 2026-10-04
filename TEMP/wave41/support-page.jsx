import { useEffect, useState } from 'react';
import { SupportShell } from '../../components/support-shell';
import { createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';

const views = [
  { key: 'users', title: 'کاربران', endpoint: '/support/users', fields: [['displayName', 'نام'], ['status', 'وضعیت'], ['createdAt', 'تاریخ ایجاد']] },
  { key: 'providers', title: 'ارائه‌دهندگان', endpoint: '/support/providers', fields: [['displayName', 'نام مرکز/پزشک'], ['status', 'وضعیت'], ['province.name', 'استان'], ['city.name', 'شهر'], ['doctorProfile.specialty.name', 'تخصص']] },
  { key: 'purchases', title: 'خریدها', endpoint: '/support/purchases', fields: [['plan.name', 'طرح'], ['status', 'وضعیت خرید'], ['membership.status', 'وضعیت عضویت'], ['createdAt', 'تاریخ']] },
  { key: 'memberships', title: 'عضویت‌ها', endpoint: '/support/memberships', fields: [['plan.name', 'طرح'], ['status', 'وضعیت'], ['startsAt', 'شروع'], ['endsAt', 'پایان']] },
  { key: 'redemptions', title: 'سوابق استفاده', endpoint: '/support/redemptions', fields: [['provider.displayName', 'ارائه‌دهنده'], ['status', 'وضعیت'], ['createdAt', 'تاریخ'], ['confirmedAt', 'تأیید']] },
  { key: 'refund-cases', title: 'پرونده‌های بازپرداخت', endpoint: '/support/refund-cases', fields: [['purchase.plan.name', 'طرح'], ['status', 'وضعیت پرونده'], ['requestReasonCode', 'علت درخواست'], ['purchase.status', 'وضعیت خرید'], ['requestedAt', 'تاریخ درخواست'], ['decisionReasonCode', 'نتیجه بررسی']] },
];
const statusLabels = { ACTIVE: 'فعال', PENDING: 'در انتظار', PENDING_REVIEW: 'در انتظار بررسی', APPROVED: 'تأییدشده', APPROVED_PENDING_EXECUTION: 'تأیید داخلی؛ بدون اجرای بازپرداخت', REQUESTED: 'ثبت‌شده', PAID: 'پرداخت‌شده', PENDING_PAYMENT: 'در انتظار پرداخت', INITIATED: 'آغازشده', CONFIRMED: 'تأییدشده', CANCELLED: 'لغوشده', EXPIRED: 'منقضی', REVERSED: 'برگشت‌خورده', REJECTED: 'ردشده', SUSPENDED: 'معلق', DISABLED: 'غیرفعال' };
function getPath(value, path) { return path.split('.').reduce((item, part) => item?.[part], value); }
function display(value, path) {
  if (value === null || value === undefined || value === '') return '—';
  if (path.endsWith('At')) return new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });
  return statusLabels[value] || String(value);
}

export default function SupportDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [userQuery, setUserQuery] = useState('');
  useEffect(() => {
    setLoading(true); setError('');
    const api = createApiClient({ getSession: readSession });
    Promise.all([api.get('/support/summary'), ...views.map(({ endpoint }) => api.get(endpoint))])
      .then(([summary, ...records]) => setData({ summary, records }))
      .catch(() => setError('اطلاعات پشتیبانی دریافت نشد. دسترسی یا اتصال را بررسی کنید و دوباره تلاش کنید.'))
      .finally(() => setLoading(false));
  }, [retry]);
  return <SupportShell title="مرکز پشتیبانی"><div className="support-dashboard">
    <p className="page-description">دسترسی فقط‌خواندنی برای پیگیری وضعیت. تغییر نقش، عملیات مالی، اطلاعات هویتی و اطلاعات تماس در این پنل ارائه نمی‌شود.</p>
    {loading && <p role="status">در حال بارگذاری اطلاعات مجاز…</p>}
    {error && <section className="ui-state ui-state--error" role="alert">{error}<button type="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></section>}
    {data && <>
      <section className="support-summary" aria-label="خلاصه وضعیت‌ها">
        {views.map(({ key, title }) => <article className="card" key={key}><h2>{title}</h2><ul>{Object.entries(data.summary[key.replace('-', '_')] || {}).map(([status, count]) => <li key={status}>{statusLabels[status] || status}: {count}</li>)}</ul></article>)}
      </section>
      {views.map((view, index) => <section className="card support-section" id={view.key} key={view.key} aria-labelledby={`${view.key}-heading`}>
        <h2 id={`${view.key}-heading`}>{view.title}</h2>
        {view.key === 'users' && <label htmlFor="support-user-search">جست‌وجو بر اساس نام<input id="support-user-search" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} /></label>}
        {(() => { const rows = data.records[index] || []; const visible = view.key === 'users' && userQuery.trim() ? rows.filter((row) => row.displayName?.includes(userQuery.trim())) : rows; return !visible.length ? <p className="ui-state ui-state--empty">{rows.length ? 'کاربری با این نام در فهرست اخیر پیدا نشد.' : 'موردی برای نمایش ثبت نشده است.'}</p> : <><p className="muted-text">{rows.length >= 100 ? 'حداکثر ۱۰۰ رکورد اخیر؛ برای اقدام تغییردهنده از مسیر مجاز دیگری پیگیری شود.' : `${rows.length} مورد`}</p><div className="support-records">{visible.map((row, rowIndex) => <article className="support-record" key={`${view.key}-${row.id || rowIndex}`}><dl>{view.fields.map(([path, label]) => <div key={path}><dt>{label}</dt><dd>{display(getPath(row, path), path)}</dd></div>)}</dl></article>)}</div></>; })()}
      </section>)}
    </>}
  </div></SupportShell>;
}
