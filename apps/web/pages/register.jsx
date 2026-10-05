import Link from 'next/link';
import { AuthForm } from '../components/auth-form';
import { AuthPageShell } from '../components/auth-page-shell';

export default function Register() {
  return (
    <AuthPageShell
      eyebrow="ایجاد حساب کاربری"
      title="ثبت‌نام"
      description="برای شروع، شماره همراه خود را وارد کنید."
      footer={<>حساب کاربری دارید؟ <Link className="auth-footer-link" href="/login">ورود</Link></>}
    >
      <AuthForm mode="register" />
    </AuthPageShell>
  );
}
