import { AdminShell, useAdminResource } from '../../components/admin-shell';
import { labelStatus } from '../../lib/presentation';

export default function AdminMemberships() {
  const { data, message } = useAdminResource('/admin/memberships');
  return <AdminShell title="عملیات عضویت‌ها" permission="memberships.read">
    <p role="status">{message}</p>
    {data && !data.length && <p>عضویتی ثبت نشده است.</p>}
    {data && <ul className="card-list">{data.map((membership) => <li key={membership.id}>
      <h2>عضویت <bdi dir="ltr">{membership.id}</bdi></h2>
      <p>مشتری: <bdi dir="ltr">{membership.userId}</bdi></p>
      <p>طرح: <bdi dir="ltr">{membership.planId}</bdi></p>
      <p>وضعیت: {labelStatus(membership.status)}</p>
      <p>شروع: {membership.startsAt ? new Date(membership.startsAt).toLocaleDateString('fa-IR') : '—'}</p>
      <p>پایان: {membership.endsAt ? new Date(membership.endsAt).toLocaleDateString('fa-IR') : '—'}</p>
    </li>)}</ul>}
  </AdminShell>;
}
