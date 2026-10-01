import { AdminShell, useAdminResource } from '../../components/admin-shell';
import { formatMoney, labelStatus } from '../../lib/presentation';

export default function AdminPurchases() {
  const { data, message } = useAdminResource('/admin/purchases');
  return <AdminShell title="عملیات خرید" permission="purchases.read">
    <p role="status">{message}</p>
    {data && !data.length && <p>خریدی ثبت نشده است.</p>}
    {data && <ul className="card-list">{data.map((purchase) => <li key={purchase.id}>
      <h2>{formatMoney(purchase.amountSnapshot, purchase.currencySnapshot)}</h2>
      <p>شناسه طرح: <bdi dir="ltr">{purchase.planId}</bdi></p>
      <p>وضعیت: {labelStatus(purchase.status)}</p>
      <p>اعتبار: {purchase.validityDaysSnapshot} روز</p>
      <small>{purchase.createdAt ? new Date(purchase.createdAt).toLocaleString('fa-IR') : '—'}</small>
    </li>)}</ul>}
  </AdminShell>;
}
