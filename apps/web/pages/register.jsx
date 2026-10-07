import { AuthPageShell } from '../components/auth-page-shell';
import { AuthForm } from '../components/auth-form';
export default function Register() {
  const description = 'شماره همراه را وارد کنید تا فرایند عضویت را آغاز کنیم.';
  return <AuthPageShell mode="register" title="به حامی‌کارت بپیوندید" description={description}>
    <AuthForm mode="register" />
  </AuthPageShell>;
}
