import { AdminShell, useAdminResource } from '../../components/admin-shell';

export default function EligibilityReporting() {
  const { data, message } = useAdminResource('/admin/compliance/audit-events');
  const checks = (data || []).filter((row) => row.action === 'ELIGIBILITY_CHECKED');
  const positive = checks.filter((row) => row.result === 'ALLOW' || row.result === 'SUCCESS');
  return <AdminShell title="گزارش بررسی Eligibility" permission="compliance.audit_read"><section className="stack"><p role="status">{message}</p>{data && <><section className="card"><h2>نمونه operational اخیر</h2><p>منبع: audit-event projection موجود؛ حداکثر ۱۰۰ رکورد اخیر.</p><p>تعداد بررسی‌های ثبت‌شده در این نمونه: {checks.length}</p><p>نتایج مثبت قابل تشخیص در contract: {positive.length}</p><small>این اعداد total یا تعداد unique مشتری نیستند و از آن‌ها utilization استنتاج نمی‌شود.</small></section>{!checks.length ? <p>بررسی Eligibilityای در نمونه موجود نیست.</p> : <ul className="card-list">{checks.map((row) => <li key={row.audit_id}><p>نتیجه: {row.result || '—'}</p><p>Capability: {row.capability || '—'}</p><small>{row.created_at ? new Date(row.created_at).toLocaleString('fa-IR') : '—'}</small></li>)}</ul>}</>}</section></AdminShell>;
}
