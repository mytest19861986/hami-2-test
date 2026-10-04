import { AdminShell, useAdminResource } from '../../components/admin-shell';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../../components/foundation';
import { formatMoney, labelStatus } from '../../lib/presentation';

export default function AdminRefundCases() {
  const { data, message } = useAdminResource('/admin/refund-cases');
  return <AdminShell title="درخواست‌های تطبیق خرید" permission="purchases.read"><section className="stack"><p role="status">{message}</p><p className="card">این صف فقط پرونده داخلی را مدیریت می‌کند. تأیید درخواست، PSP را اجرا نمی‌کند و خرید را REFUNDED نمی‌کند.</p>{!data && message === 'در حال بارگذاری…' && <LoadingState />}{!data && message && message !== 'در حال بارگذاری…' && <ErrorState title="فهرست درخواست‌ها قابل دریافت نیست." />}{data && !data.length && <EmptyState title="درخواستی ثبت نشده است" />}{data && data.length > 0 && <ul className="card-list">{data.map((row) => <li key={row.id}><div className="provider-card-head"><h2><a href={`/admin/refund-cases/${row.id}`}>پرونده {row.id}</a></h2><StatusBadge tone={row.status === 'REQUESTED' ? 'warning' : 'neutral'}>{labelStatus(row.status)}</StatusBadge></div><p>{row.purchase?.planName || 'طرح'} · {formatMoney(row.purchase?.amountSnapshot, row.purchase?.currencySnapshot)}</p><p>وضعیت خرید: {labelStatus(row.purchase?.status)} · فعال‌سازی: {labelStatus(row.purchase?.activationStatus)}</p><p>دلیل درخواست: {labelStatus(row.requestReasonCode)}</p><small>{row.requestedAt ? new Date(row.requestedAt).toLocaleString('fa-IR') : '—'}</small></li>)}</ul>}</section></AdminShell>;
}
