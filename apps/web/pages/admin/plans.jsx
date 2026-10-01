import { AdminShell, useAdminResource } from '../../components/admin-shell';

import { labelStatus } from '../../lib/presentation';

export default function AdminPlans() {
  const { data, message } = useAdminResource('/admin/benefit-plans');
  return <AdminShell title="مدیریت پلن‌ها" permission="plans.read">
    <p role="status">{message}</p>
    {data && <ul className="card-list">{data.map((plan) => <li key={plan.id}>
      <h2>{plan.name}</h2><p>وضعیت: {labelStatus(plan.status)}</p>
      <p>قیمت: {Number(plan.price).toLocaleString('fa-IR')} {plan.currency}</p>
      <p>اعتبار: {plan.validityDays} روز</p>
    </li>)}</ul>}
  </AdminShell>;
}
