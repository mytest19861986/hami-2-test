import { useState } from 'react';
import { createApiClient } from '../lib/api-client';
import { writeSession } from '../lib/session';

export function AuthForm({ mode = 'login' }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [salesInviteCode, setSalesInviteCode] = useState('');
  const [loginOtp, setLoginOtp] = useState(false);
  const [step, setStep] = useState(mode === 'register' ? 'request' : 'password');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [busy, setBusy] = useState(false);
  const [passwordSetupToken, setPasswordSetupToken] = useState('');
  const isRegister = mode === 'register';

  async function finishLogin(api, result) {
    writeSession(result);
    try {
      const user = await api.get('/auth/me');
      const roles = (user.roles || []).map((link) => link?.role?.name).filter(Boolean);
      const supportOnly = roles.includes('SUPPORT') && !roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
      globalThis.location.replace(supportOnly ? '/support' : '/dashboard');
    } catch {
      globalThis.location.replace('/dashboard');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setMessageType('info');
    const api = createApiClient();
    try {
      if (isRegister && step === 'request') {
        const result = await api.post('/auth/register/request-otp', { phone });
        setMessage(result?.devCode ? `کد توسعه: ${result.devCode}` : 'کد تأیید ارسال شد.');
        setMessageType('success');
        setStep('verify');
      } else if (isRegister && step === 'verify') {
        const result = await api.post('/auth/register/verify-otp', {
          phone,
          code,
          ...(salesInviteCode.trim() ? { salesInviteCode: salesInviteCode.trim() } : {}),
        });
        setPasswordSetupToken(result.passwordSetupToken);
        setStep('set-password');
      } else if (isRegister) {
        if (password !== confirm) throw new Error('رمزهای عبور یکسان نیستند.');
        await api.post('/auth/register/set-password', { phone, password, passwordSetupToken });
        const result = await api.post('/auth/login/password', { phone, password });
        await finishLogin(api, result);
      } else if (loginOtp && step === 'password') {
        const result = await api.post('/auth/login/request-otp', { phone });
        setMessage(result?.devCode ? `کد توسعه: ${result.devCode}` : 'کد تأیید ارسال شد.');
        setMessageType('success');
        setStep('verify');
      } else if (loginOtp) {
        const result = await api.post('/auth/login/verify-otp', { phone, code });
        await finishLogin(api, result);
      } else {
        const result = await api.post('/auth/login/password', { phone, password });
        await finishLogin(api, result);
      }
    } catch (error) {
      setMessage(error.message);
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} aria-label={isRegister ? 'ثبت‌نام' : 'ورود'} aria-busy={busy}>
      {!isRegister && (
        <div className="auth-method">
          <span className="auth-field-label" id="auth-method-label">روش ورود</span>
          <div className="auth-method-switch" role="group" aria-labelledby="auth-method-label">
            <button className="auth-method-option" type="button" aria-pressed={!loginOtp} onClick={() => { setLoginOtp(false); setStep('password'); }}>
              رمز عبور
            </button>
            <button className="auth-method-option" type="button" aria-pressed={loginOtp} onClick={() => { setLoginOtp(true); setStep('password'); }}>
              کد یک‌بارمصرف
            </button>
          </div>
        </div>
      )}

      <label className="auth-field" htmlFor="phone">
        <span className="auth-field-label">شماره همراه</span>
        <input className="auth-input" id="phone" type="tel" dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" />
      </label>

      {isRegister && (
        <label className="auth-field" htmlFor="sales-invite-code">
          <span className="auth-field-label">کد دعوت همکار فروش <span className="auth-optional">(اختیاری)</span></span>
          <input className="auth-input" id="sales-invite-code" value={salesInviteCode} onChange={(event) => setSalesInviteCode(event.target.value)} autoComplete="off" spellCheck="false" dir="ltr" />
        </label>
      )}

      {((!isRegister && !loginOtp) || (isRegister && step === 'set-password')) && (
        <label className="auth-field" htmlFor="password">
          <span className="auth-field-label">رمز عبور</span>
          <input className="auth-input" id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={isRegister ? 'new-password' : 'current-password'} />
        </label>
      )}

      {isRegister && step === 'set-password' && (
        <label className="auth-field" htmlFor="confirm">
          <span className="auth-field-label">تکرار رمز عبور</span>
          <input className="auth-input" id="confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required autoComplete="new-password" />
        </label>
      )}

      {((isRegister && step === 'verify') || (!isRegister && loginOtp && step === 'verify')) && (
        <label className="auth-field" htmlFor="code">
          <span className="auth-field-label">کد تأیید</span>
          <input className="auth-input auth-input--numeric" id="code" type="text" dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} required inputMode="numeric" autoComplete="one-time-code" />
        </label>
      )}

      <button className="auth-submit" disabled={busy} type="submit">
        {busy ? 'در حال ارسال…' : isRegister ? (step === 'request' ? 'درخواست کد' : step === 'verify' ? 'تأیید کد' : 'تکمیل ثبت‌نام') : loginOtp && step === 'password' ? 'درخواست کد' : loginOtp ? 'تأیید و ورود' : 'ورود به حساب'}
      </button>
      <p className={`auth-status${messageType === 'info' ? '' : ` auth-status--${messageType}`}`} role={messageType === 'error' ? 'alert' : 'status'} aria-live={messageType === 'error' ? 'assertive' : 'polite'}>{message}</p>
    </form>
  );
}
