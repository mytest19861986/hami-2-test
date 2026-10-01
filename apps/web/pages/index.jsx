import { useState } from 'react';
import { createApiClient } from '../lib/api-client';
import { clearSession, readSession, writeSession } from '../lib/session';

export default function Home() {
  const [session, setSession] = useState(() => readSession());
  const [message, setMessage] = useState('');
  const api = createApiClient({ getSession: () => session, setSession: (next) => { writeSession(next); setSession(next); }, clearSession: () => { clearSession(); setSession(null); } });
  async function checkSession() { try { await api.get('/auth/me'); setMessage('نشست فعال است.'); } catch (error) { setMessage(error.message); } }
  return <main dir="rtl" lang="fa"><h1>حمایت کارت</h1><p>پوسته‌ی RTL و لایه‌ی ارتباط با API فعال است.</p><button type="button" onClick={checkSession}>بررسی نشست</button>{session && <button type="button" onClick={() => { clearSession(); setSession(null); }}>خروج</button>}<p role="status">{message}</p></main>;
}
