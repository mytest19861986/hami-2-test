import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UserShell } from '../../components/user-shell';
import { DegradedState, EmptyState, ErrorState, LoadingState } from '../../components/foundation';
import { createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';
import { formatMoney, labelStatus } from '../../lib/presentation';

const resultText = { PENDING_PAYMENT: 'پرداخت در انتظار تأیید backend است؛ این صفحه وضعیت را تغییر نمی‌دهد.', PAID: 'پرداخت توسط backend تأیید شده است.', REFUNDED: 'وضعیت بازپرداخت توسط backend ثبت شده است.', PAYMENT_UNKNOWN: 'وضعیت پرداخت هنوز مشخص نیست؛ اقدامی از این صفحه انجام نمی‌شود.', UNKNOWN: 'وضعیت پرداخت هنوز مشخص نیست؛ اقدامی از این صفحه انجام نمی‌شود.' };
const refundCaseText = {
  REQUESTED: 'درخواست ثبت شده و در انتظار بررسی Admin است. این وضعیت به معنی بازگشت وجه نیست.',
  APPROVED_PENDING_EXECUTION: 'درخواست داخلی تأیید شده، اما هنوز هیچ اجرای PSP یا تأیید مالی رخ نداده است؛ خرید همچنان PAID است.',
  REJECTED: 'درخواست تطبیق رد شده است؛ وضعیت مالی خرید تغییر نکرده است.',
};

export default function PurchaseDetail() {
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [state, setState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [reasonCode, setReasonCode] = useState('ACTIVATION_REJECTED');
  const [requesting, setRequesting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!router.isReady) return undefined;
    let active = true;
    const api = createApiClient({ getSession: readSession });
    setState('loading');
    api.get('/users/me/purchases').then((rows) => {
      const row = rows.find((entry) => entry.id === router.query.id);
      if (!row) throw Object.assign(new Error('PURCHASE_NOT_FOUND'), { status: 404 });
      if (active) { setItem(row); setState('success'); }
    }).catch((error) => {
      if (active) setState(error?.status === 429 || error?.status === 503 || error?.status === 0 ? 'degraded' : error?.status === 404 ? 'empty' : 'error');
    });
    return () => { active = false; };
  }, [router.isReady, router.query.id, retry]);

  async function requestRefundCase() {
    if (!item || requesting) return;
    setRequesting(true); setActionError(''); setActionMessage('');
    try {
      const api = createApiClient({ getSession: readSession });
      const refundCase = await api.post(`/users/me/purchases/${item.id}/refund-case`, { reasonCode }, { headers: { 'idempotency-key': `refund-case:${item.id}` } });
      setItem((current) => ({ ...current, refundCase }));
      setActionMessage('درخواست تطبیق ثبت شد؛ این ثبت به‌تنهایی موجب بازپرداخت وجه نمی‌شود.');
    } catch (error) {
      setActionError(error.code === 'REFUND_CASE_ALREADY_EXISTS' ? 'برای این خرید قبلاً پرونده ثبت شده؛ وضعیت را بازخوانی کنید.' : error.message);
      if (error.code === 'REFUND_CASE_ALREADY_EXISTS') setRetry((value) => value + 1);
    } finally { setRequesting(false); }
  }

  return <UserShell title="نتیجه خرید"><section className="stack" aria-labelledby="payment-result-heading"><h2 id="payment-result-heading">نتیجه خرید</h2>{state === 'loading' && <LoadingState />}{state === 'degraded' && <><DegradedState>سرویس موقتاً محدود است؛ نتیجه جدیدی اعلام نمی‌شود.</DegradedState><button type="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></>}{state === 'error' && <ErrorState title="نتیجه خرید قابل دریافت نیست." onRetry={() => setRetry((value) => value + 1)} />}{state === 'empty' && <EmptyState title="این خرید پیدا نشد." />}{state === 'success' && item && <article className="card"><h3>خرید {item.id}</h3><p>مبلغ ثبت‌شده: {formatMoney(item.amountSnapshot, item.currencySnapshot)}</p><p>اعتبار ثبت‌شده: {item.validityDaysSnapshot} روز</p><p>وضعیت پرداخت backend: {labelStatus(item.status)}</p><p>وضعیت فعال‌سازی: {labelStatus(item.activationStatus)}</p><p role="status">{item.status === 'PAID' && item.activationStatus === 'PENDING' ? 'پرداخت تأیید شده؛ فعال‌سازی در انتظار تصمیم جداگانه است.' : item.status === 'PAID' && item.activationStatus === 'REJECTED' ? 'فعال‌سازی رد شده است؛ خرید همچنان پرداخت‌شده است و بازپرداخت خودکار انجام نمی‌شود.' : resultText[item.status] || 'وضعیت از backend دریافت شد؛ این صفحه فقط نمایش‌دهنده است.'}</p>{item.refundCase ? <section aria-label="وضعیت درخواست تطبیق"><h4>درخواست تطبیق / بازپرداخت</h4><p role="status">{refundCaseText[item.refundCase.status] || labelStatus(item.refundCase.status)}</p><p>وضعیت پرونده: {labelStatus(item.refundCase.status)}</p></section> : item.status === 'PAID' && item.activationStatus === 'REJECTED' ? <section className="stack" aria-label="ثبت درخواست تطبیق"><h4>درخواست بررسی بازپرداخت</h4><p>ثبت درخواست یا تأیید داخلی، بازگشت وجه نیست. وضعیت مالی فقط پس از تأیید مستقل PSP قابل تغییر است.</p><label htmlFor="refund-case-reason">دلیل درخواست</label><select id="refund-case-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="ACTIVATION_REJECTED">رد شدن فعال‌سازی</option><option value="DUPLICATE_PURCHASE">خرید تکراری</option><option value="SERVICE_NOT_DELIVERED">خدمت ارائه نشده</option><option value="OTHER_POLICY_REASON">دلیل سیاستی دیگر</option></select><button type="button" disabled={requesting} onClick={requestRefundCase}>{requesting ? 'در حال ثبت…' : 'ثبت درخواست تطبیق'}</button>{actionMessage && <p role="status">{actionMessage}</p>}{actionError && <p role="alert">{actionError}</p>}</section> : null}<button type="button" onClick={() => setRetry((value) => value + 1)}>بازخوانی وضعیت</button></article>}</section></UserShell>;
}
