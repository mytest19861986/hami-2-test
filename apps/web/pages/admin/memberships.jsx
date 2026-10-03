import { useState } from 'react';
import { AdminShell, useAdminResource } from '../../components/admin-shell';
import { can } from '../../lib/api-client';
import { readSession } from '../../lib/session';
import { labelStatus } from '../../lib/presentation';

export default function AdminMemberships() {
  const { data, message, api, setData, setMessage } = useAdminResource('/admin/memberships');
  const [reasons, setReasons] = useState({});
  async function decide(id, decision) {
    try {
      await api.post(`/admin/memberships/${id}/${decision}`, decision === 'reject' ? { reasonCode: reasons[id] || '' } : {});
      const fresh = await api.get('/admin/memberships'); setData(fresh); setMessage(decision === 'approve' ? 'عضویت فعال شد.' : 'درخواست رد شد؛ بازپرداخت خودکار انجام نشد.');
    } catch (error) { setMessage(error.message); }
  }
  const session = readSession();
  return <AdminShell title="عملیات عضویت‌ها" permission="memberships.read">
    <p role="status">{message}</p>
    {data && !data.length && <p>عضویتی ثبت نشده است.</p>}
    {data && <ul className="card-list">{data.map((membership) => <li key={membership.id}>
      <h2>عضویت <bdi dir="ltr">{membership.id}</bdi></h2>
      <p>مشتری: <bdi dir="ltr">{membership.userId}</bdi></p>
      <p>طرح: <bdi dir="ltr">{membership.planId}</bdi></p>
      <p>وضعیت: {labelStatus(membership.status)}</p>
      <p>وضعیت خرید: {labelStatus(membership.purchase?.status)}</p>
      {membership.status === 'REJECTED' && membership.purchase?.status === 'PAID' && <p role="status">نیازمند پیگیری مستقل بازپرداخت/تطبیق؛ بازپرداخت خودکار نشده است.</p>}
      {membership.status === 'PENDING' && membership.purchase?.status === 'PAID' && <div>
        {can(session, 'memberships.approve') && <button type="button" onClick={() => decide(membership.id, 'approve')}>تأیید فعال‌سازی</button>}
        {can(session, 'memberships.reject') && <><label>دلیل رد<select value={reasons[membership.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [membership.id]: event.target.value }))}><option value="">انتخاب دلیل</option><option value="NOT_ELIGIBLE">عدم احراز شرایط</option><option value="DOCUMENTS_INVALID">مدارک نامعتبر</option><option value="DUPLICATE_REQUEST">درخواست تکراری</option><option value="POLICY_REQUIREMENT_NOT_MET">شرط سیاست احراز نشد</option><option value="OTHER_POLICY_REASON">سایر دلایل سیاستی</option></select></label><button type="button" disabled={!reasons[membership.id]} onClick={() => decide(membership.id, 'reject')}>رد درخواست</button></>}
      </div>}
      <p>شروع: {membership.startsAt ? new Date(membership.startsAt).toLocaleDateString('fa-IR') : '—'}</p>
      <p>پایان: {membership.endsAt ? new Date(membership.endsAt).toLocaleDateString('fa-IR') : '—'}</p>
    </li>)}</ul>}
  </AdminShell>;
}
