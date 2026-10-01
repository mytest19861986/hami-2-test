import Link from 'next/link';
import { AuthForm } from '../components/auth-form';
export default function Login() { return <main dir="rtl" lang="fa"><h1>ورود به حمایت کارت</h1><AuthForm /><p><Link href="/register">ثبت‌نام</Link></p></main>; }
