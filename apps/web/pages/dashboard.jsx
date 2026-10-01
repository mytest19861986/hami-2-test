import { useEffect, useState } from 'react';
import { UserShell } from '../components/user-shell';
import { Card, DegradedState, EmptyState, ErrorState, LoadingState, Stack } from '../components/foundation';
import { createApiClient } from '../lib/api-client';
import { readSession } from '../lib/session';
import { formatMoney, labelStatus } from '../lib/presentation';

const feeTypes = new Set(['PLATFORM_FEE', 'FEE', 'PAYOUT_FEE']);
const withdrawalLabels = { PENDING: 'در انتظار بررسی', APPROVED: 'تأیید شده', PAYOUT_PENDING: 'در حال پرداخت', PAYOUT_UNKNOWN: 'در حال بررسی؛ اقدامی لازم نیست', PAID: 'پرداخت شده', FAILED: 'ناموفق؛ امکان درخواست مجدد پس از تأیید سامانه', CANCELLED: 'لغو شده' };

function WithdrawalStatus({ rows, currency }) {
  if (!rows.length) return <EmptyState title="درخواستی ثبت نشده است">وضعیت برداشت‌های شما اینجا نمایش داده می‌شود.</EmptyState>;
  return <ul className="card-list">{rows.map((item) => { const status = item.status || 'PENDING'; return <li key={item.id}><h3>برداشت</h3><p>{formatMoney(item.amount, currency)}</p><p><strong>{withdrawalLabels[status] || labelStatus(status)}</strong></p>{status === 'PAYOUT_UNKNOWN' && <p role="status">این برداشت در حال بررسی است؛ برداشت مجدد یا لغو از این صفحه انجام نمی‌شود.</p>}<small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }) : '—'}</small></li>; })}</ul>;
}

export default function Dashboard() {
  const [data, setData] = useState(null); const [summary, setSummary] = useState(null); const [withdrawals, setWithdrawals] = useState([]); const [state, setState] = useState('loading'); const [retryAfterMs, setRetryAfterMs] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { const session = readSession(); if (!session) return; let active = true; const api = createApiClient({ getSession: readSession }); setState('loading'); Promise.all([api.get('/users/me/wallet'), api.get('/users/me/wallet/withdrawals'), api.get('/customer/dashboard/summary')]).then(([wallet, rows, customerSummary]) => { if (!active) return; setData(wallet); setSummary(customerSummary.customer); setWithdrawals(rows || []); setRetryAfterMs(null); setState('success'); }).catch((error) => { if (!active) return; setRetryAfterMs(error?.retryAfterMs); setState(error?.status === 429 || error?.status === 503 || error?.status === 0 ? 'degraded' : 'error'); }); return () => { active = false; }; }, [attempt]);
  const transactions = data?.transactions?.filter((item) => !feeTypes.has(item.type)) || [];
  return <UserShell title="داشبورد"><Stack>{state === 'loading' && <LoadingState />}{state === 'error' && <ErrorState title="اطلاعات داشبورد قابل دریافت نیست." onRetry={() => setAttempt((value) => value + 1)} />}{state === 'degraded' && <><DegradedState retryAfterMs={retryAfterMs}>ارتباط با سرویس موقتاً محدود است؛ داده مالی جدیدی نمایش داده نمی‌شود.</DegradedState><button type="button" onClick={() => setAttempt((value) => value + 1)}>تلاش دوباره</button></>}{data && state === 'success' && <><div className="dashboard-grid"><Card title="موجودی قابل برداشت"><p className="dashboard-balance" dir="ltr">{formatMoney(data.balance, data.currency)}</p><a href="/wallet">مشاهده کیف پول</a></Card><Card title="وضعیت برداشت"><WithdrawalStatus rows={withdrawals.slice(0, 1)} currency={data.currency} /></Card></div><Card title="اقدام‌های سریع"><nav aria-label="اقدام‌های داشبورد"><a className="ui-action" href="/wallet">کیف پول و برداشت</a><a className="ui-action" href="/profile">پروفایل</a><a className="ui-action" href="/referrals">معرفی دوستان</a></nav></Card><Card title="تراکنش‌های اخیر">{!transactions.length ? <EmptyState title="تراکنشی ثبت نشده است" /> : <ul className="card-list">{transactions.slice(0, 5).map((item) => <li key={item.id}><h3>تراکنش کیف پول</h3><p dir="ltr">{formatMoney(item.amount, item.currency || data.currency)}</p><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }) : '—'}</small></li>)}</ul>}</Card><Card title="اعلان‌ها"><EmptyState title="اعلان کاربری در دسترس نیست">اعلان‌های داخلی یا audit در داشبورد نمایش داده نمی‌شوند.</EmptyState></Card></>}</Stack></UserShell>;
}
