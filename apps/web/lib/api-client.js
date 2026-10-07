const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
let refreshInFlight = null;

export class ApiError extends Error {
  constructor(status, code, message = code, retryAfterMs = null) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.retryAfterMs = retryAfterMs; }
}

export function mapApiError(status, payload) {
  const code = payload?.error || 'NETWORK_ERROR';
  const messages = { 400: 'اطلاعات واردشده معتبر نیست.', 401: 'نشست شما معتبر نیست.', 403: 'دسترسی به این بخش مجاز نیست.', 409: 'این درخواست با وضعیت فعلی تعارض دارد.', 429: 'تعداد درخواست‌ها زیاد است؛ دوباره تلاش کنید.' };
  const codeMessages = { AUTH_FAILED: 'شماره همراه یا رمز عبور صحیح نیست.', OTP_INVALID: 'کد تأیید معتبر نیست یا زمان آن پایان یافته است.', MOBILE_NOT_VERIFIED: 'ابتدا شماره همراه خود را تأیید کنید.', PASSWORD_SETUP_REQUIRED: 'برای این حساب باید ابتدا رمز عبور تعیین شود.', SALES_INVITE_INVALID_OR_USED: 'کد دعوت نامعتبر، منقضی یا قبلاً استفاده شده است.', REGISTRATION_ALREADY_COMPLETED: 'برای این شماره قبلاً حساب فعال وجود دارد؛ حساب موجود به نماینده دیگری منتسب نمی‌شود.', REGISTRATION_NOT_ALLOWED: 'ثبت‌نام برای این حساب در وضعیت فعلی ممکن نیست.', REDEMPTION_TOKEN_INVALID: 'کد واردشده معتبر نیست.', REDEMPTION_EXPIRED: 'کد استفاده منقضی شده است.', REDEMPTION_NOT_CONFIRMABLE: 'این درخواست دیگر قابل تأیید نیست.', REDEMPTION_NOT_CANCELLABLE: 'فقط درخواست‌های در انتظار تأیید قابل لغو هستند.', REDEMPTION_NOT_ELIGIBLE: 'این عضویت یا مزیت دیگر معتبر نیست.', REVERSAL_REASON_REQUIRED: 'ثبت دلیل برگشت الزامی است.', REFUND_PROVIDER_VERIFICATION_REQUIRED: 'تأیید مستقل PSP موجود نیست؛ وضعیت خرید و همه آثار مالی بدون تغییر ماند.', REFUND_CASE_ALREADY_EXISTS: 'برای این خرید قبلاً پرونده ثبت شده است.', REFUND_CASE_NOT_ELIGIBLE: 'فقط خرید پرداخت‌شده با فعال‌سازی ردشده واجد ثبت این پرونده است.', REFUND_CASE_NOT_ACTIONABLE: 'این پرونده دیگر قابل تصمیم‌گیری نیست.', REFUND_CASE_DECISION_CONFLICT: 'یک تصمیم هم‌زمان ثبت شده؛ وضعیت پرونده را دوباره بخوانید.' };
  return new ApiError(status, code, codeMessages[code] || messages[status] || 'ارتباط با سرویس ممکن نیست.');
}

export function createApiClient({ getSession, setSession, clearSession, fetchImpl = fetch } = {}) {
  function csrfToken() {
    if (typeof document === 'undefined') return null;
    return document.cookie.split('; ').find((item) => item.startsWith('__Host-csrf='))?.split('=').slice(1).join('=') || null;
  }
  async function refreshSession(session) {
    if (!refreshInFlight) {
      const performRefresh = async () => {
        const csrf = csrfToken();
        const refresh = await fetchImpl(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) }, credentials: 'include', body: JSON.stringify({ sessionId: session.sessionId, refreshToken: session.refreshToken }) });
        if (!refresh.ok) throw new Error('REFRESH_INVALID');
        return refresh.json();
      };
      refreshInFlight = (typeof navigator !== 'undefined' && navigator.locks?.request
        ? navigator.locks.request('hamayat-auth-refresh', { mode: 'exclusive' }, performRefresh)
        : performRefresh()).finally(() => { refreshInFlight = null; });
    }
    return refreshInFlight;
  }
  async function request(path, options = {}, retried = false) {
    const session = getSession?.();
    const headers = { 'content-type': 'application/json', 'x-auth-mode': 'cookie', ...(options.headers || {}) };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(options.method).toUpperCase())) {
      const csrf = csrfToken(); if (csrf && !headers['x-csrf-token']) headers['x-csrf-token'] = csrf;
    }
    let response;
    try { response = await fetchImpl(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' }); }
    catch { throw new ApiError(0, 'NETWORK_ERROR', 'ارتباط با سرویس ممکن نیست.'); }
    let payload = null;
    try { payload = await response.json(); } catch { /* empty response */ }
    if (response.status === 401 && !retried && session) {
      try {
        const next = await refreshSession(session); setSession?.(next);
        return request(path, options, true);
      } catch { clearSession?.(); }
    }
    if (!response.ok) { const retryAfter = Number(response.headers?.get?.('retry-after')); const error = mapApiError(response.status, payload); error.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null; throw error; }
    return payload;
  }
  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}

export function can(session, permission) { return Boolean(session?.permissions?.includes(permission)); }

export function revokeCurrentSession(session, fetchImpl) {
  const api = createApiClient({ getSession: () => session, fetchImpl });
  return api.post('/auth/logout', session?.sessionId ? { sessionId: session.sessionId } : {});
}
