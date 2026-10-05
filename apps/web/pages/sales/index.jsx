import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserShell } from '../../components/user-shell';
import { DegradedState, EmptyState, ErrorState, LoadingState } from '../../components/foundation';
import { ApiError, createApiClient } from '../../lib/api-client';
import { readSession } from '../../lib/session';

export default function Sales() {
  const api = useMemo(() => createApiClient({ getSession: readSession }), []);
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');
  const [retryAfterMs, setRetryAfterMs] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const items = await api.get('/sales-partner/customers');
      setRows(Array.isArray(items) ? items : []);
      setState('success');
      setRetryAfterMs(null);
    } catch (error) {
      setRetryAfterMs(error?.retryAfterMs ?? null);
      setState(error instanceof ApiError && [0, 429, 503].includes(error.status) ? 'degraded' : 'error');
    }
  }, [api]);

  useEffect(() => { load(); }, [load, attempt]);

  async function createInvite() {
    setBusy(true);
    setMessage('');
    setInvite(null);
    try {
      const created = await api.post('/sales-partner/customers', {});
      setInvite(created);
      setMessage('کد دعوت ساخته شد. آن را فقط در اختیار مشتری موردنظر بگذارید؛ این کد پس از یک ثبت‌نام تأییدشده مصرف می‌شود.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await globalThis.navigator.clipboard.writeText(invite.code);
      setMessage('کد دعوت کپی شد.');
    } catch {
      setMessage('کپی خودکار ممکن نشد؛ کد را انتخاب و دستی کپی کنید.');
    }
  }

  return <UserShell title="پنل همکار فروش">
    <section className="card" aria-labelledby="sales-registration-heading">
      <h2 id="sales-registration-heading">دعوت مشتری برای ثبت‌نام</h2>
      <p>مشتری با شمارهٔ خودش ثبت‌نام می‌کند، موبایل را با کد یک‌بارمصرف تأیید می‌کند و رمز خودش را می‌سازد. با تکمیل OTP، انتساب به‌صورت غیرقابل‌تغییر ثبت می‌شود؛ این دعوت کمیسیون یا اعتبار کیف پول ایجاد نمی‌کند.</p>
      <button className="sales-invite-create" type="button" onClick={createInvite} disabled={busy}>{busy ? 'در حال ساخت دعوت…' : 'ساخت کد دعوت یک‌بارمصرف'}</button>
      {message && <p role="status" aria-live="polite">{message}</p>}
      {invite && <div className="card" aria-label="کد دعوت تازه">
        <label htmlFor="sales-invite-output">کد دعوت (فقط همین بار نمایش داده می‌شود)</label>
        <input id="sales-invite-output" value={invite.code} readOnly dir="ltr" autoComplete="off" />
        <button type="button" onClick={copyInvite}>کپی کد دعوت</button>
        <p>مشتری کد را در فرم <a href="/register">ثبت‌نام</a> وارد کند و شمارهٔ موبایل خودش را تأیید کند.</p>
        <small>انقضا: {new Date(invite.expiresAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}</small>
      </div>}
    </section>

    <section aria-labelledby="sales-attributed-heading">
      <h2 id="sales-attributed-heading">مشتریان منتسب</h2>
      {state === 'loading' && <LoadingState />}
      {state === 'degraded' && <><DegradedState retryAfterMs={retryAfterMs}>ارتباط با سرویس موقتاً محدود است؛ دادهٔ جدیدی نمایش داده نمی‌شود.</DegradedState><button type="button" onClick={() => setAttempt((value) => value + 1)}>تلاش دوباره</button></>}
      {state === 'error' && <ErrorState title="فهرست مشتریان قابل دریافت نیست." onRetry={() => setAttempt((value) => value + 1)} />}
      {state === 'success' && !rows.length && <EmptyState title="مشتری منتسبی ثبت نشده است">پس از تکمیل ثبت‌نام و تأیید موبایل با کد دعوت، مشتری در این فهرست نمایش داده می‌شود.</EmptyState>}
      {state === 'success' && rows.length > 0 && <ul className="card-list">{rows.map((row) => <li key={row.id}><h3>{row.displayAlias}</h3><p dir="ltr">{row.customerRef}</p><p>وضعیت انتساب: {row.status === 'ACTIVE' ? 'فعال' : row.status}</p><p>وضعیت حساب: {row.customerStatus || 'نامشخص'}</p><small>{new Date(row.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })}</small></li>)}</ul>}
      <p role="note">شماره موبایل، شناسهٔ خام مشتری، دادهٔ خرید، کمیسیون یا اطلاعات مالی در این صفحه نمایش داده نمی‌شود.</p>
    </section>
  </UserShell>;
}
