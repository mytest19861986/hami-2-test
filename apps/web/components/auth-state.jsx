import { useEffect, useState } from 'react';
import { clearSession, readSession } from '../lib/session';
import { createApiClient } from '../lib/api-client';

export function AuthState({ children }) {
  const [state, setState] = useState('loading');
  useEffect(() => { const current = readSession(); if (!current) { setState('unauthenticated'); return; } createApiClient({ getSession: readSession, clearSession }).get('/auth/me').then(() => setState('authenticated')).catch(() => { clearSession(); setState('unauthenticated'); }); }, []);
  if (state === 'loading') return <main dir="rtl" lang="fa"><p className="ui-state ui-state--loading" role="status">در حال بررسی نشست…</p></main>;
  if (state === 'unauthenticated') return <main dir="rtl" lang="fa"><section className="ui-state ui-state--error" role="alert"><h1>نیاز به ورود</h1><p>برای ادامه وارد حساب خود شوید.</p><a href="/login">ورود</a></section></main>;
  return <>{children}</>;
}

export function SessionExpiredState() {
  return <main dir="rtl" lang="fa"><section className="ui-state ui-state--error" role="alert"><h1>نشست منقضی شده است</h1><p>برای امنیت، دوباره وارد شوید.</p><button type="button" onClick={() => { clearSession(); globalThis.location.href = '/login'; }}>ورود دوباره</button></section></main>;
}
