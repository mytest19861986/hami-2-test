import Link from 'next/link';
import { AuthForm } from '../components/auth-form';
export default function Register() { return <main dir="rtl" lang="fa"><h1>ثبت‌نام</h1><AuthForm mode="register" /><p><Link href="/login">ورود</Link></p></main>; }
