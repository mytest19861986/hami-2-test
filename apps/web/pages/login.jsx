import Link from 'next/link';
import { AuthForm } from '../components/auth-form';
import { AuthPageShell } from '../components/auth-page-shell';

export default function Login() {
  return (
    <AuthPageShell
      eyebrow="ورود به حساب کاربری"
      title="خوش آمدید"
      description="برای ادامه، شماره همراه و روش ورود را انتخاب کنید."
      footer={<>حساب کاربری ندارید؟ <Link className="auth-footer-link" href="/register">ثبت‌نام</Link></>}
    >
      <AuthForm />
    </AuthPageShell>
  );
}
