import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AdminShell } from '../../../components/admin-shell';
import { ErrorState, LoadingState } from '../../../components/foundation';
import { createApiClient, can } from '../../../lib/api-client';
import { readSession } from '../../../lib/session';
import { formatMoney, labelStatus } from '../../../lib/presentation';

const decisionReasons = ['NOT_ELIGIBLE', 'DUPLICATE_REQUEST', 'POLICY_REQUIREMENT_NOT_MET', 'OTHER_POLICY_REASON'];

export default function AdminRefundCaseDetail() {
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [state, setState] = useState('loading');
  const [reasonCode, setReasonCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!router.isReady || typeof router.query.id !== 'string') return undefined;
    let active = true;
    const api = createApiClient({ getSession: readSession });
    setState('loading');
    api.get(`/admin/refund-cases/${router.query.id}`).then((row) => { if (active) { setItem(row); setState('success'); } }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [router.isReady, router.query.id, retry]);

  async function decide(decision) {
    if (!item || busy || (decision === 'reject' && !reasonCode)) return;
    setBusy(true); setMessage('');
    try {
      const api = createApiClient({ getSession: readSession });
      const next = await api.post(`/admin/refund-cases/${item.id}/${decision}`, decision === 'reject' ? { reasonCode } : {});
      setItem(next); setMessage(decision === 'approve' ? 'پرونده داخلی تأیید شد؛ هیچ بازپرداخت یا اثر مالی اجرا نشد.' : 'پرونده رد شد؛ وضعیت مالی خرید تغییری نکرد.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  const session = readSession();
  const canReview = can(session, 'purchases.refund');
  return <AdminShell title="جزئیات درخواست تطبیق" permission="purchases.read"><section className="stack">{state === 'loading' && <LoadingState />}{state === 'error' && <ErrorState title="پرونده قابل دریافت نیست." onRetry={() => setRetry((value) => value + 1)} />}{state === 'success' && item && <article className="card"><h2>پرونده {item.id}</h2><p>شناسه خرید: <bdi dir="ltr">{item.purchaseId}</bdi></p><p>طرح: {item.purchase?.planName || '—'}</p><p>مبلغ snapshot: {formatMoney(item.purchase?.amountSnapshot, item.purchase?.currencySnapshot)}</p><p>وضعیت خرید: {labelStatus(item.purchase?.status)}</p><p>وضعیت فعال‌سازی: {labelStatus(item.purchase?.activationStatus)}</p><p>وضعیت پرونده: {labelStatus(item.status)}</p><p>دلیل درخواست: {labelStatus(item.requestReasonCode)}</p><p>تاریخ درخواست: {item.requestedAt ? new Date(item.requestedAt).toLocaleString('fa-IR') : '—'}</p>{item.decisionReasonCode && <p>دلیل تصمیم: {labelStatus(item.decisionReasonCode)}</p>}<p role="note">این ابزار فقط workflow داخلی است. APPROVED_PENDING_EXECUTION به معنی اجرای PSP نیست؛ Purchase باید PAID بماند و هیچ wallet/referral/commission reversal انجام نمی‌شود.</p>{message && <p role="status">{message}</p>}{canReview && item.status === 'REQUESTED' && <section className="stack"><button type="button" disabled={busy} onClick={() => decide('approve')}>تأیید پرونده داخلی (بدون اجرای refund)</button><label htmlFor="refund-case-decision-reason">دلیل رد پرونده</label><select id="refund-case-decision-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="">انتخاب دلیل</option>{decisionReasons.map((reason) => <option key={reason} value={reason}>{labelStatus(reason)}</option>)}</select><button type="button" disabled={busy || !reasonCode} onClick={() => decide('reject')}>رد پرونده</button></section>}<a href="/admin/refund-cases">بازگشت به فهرست</a></article>}</section></AdminShell>;
}
