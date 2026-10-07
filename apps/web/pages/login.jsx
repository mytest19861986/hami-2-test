import { AuthPageShell } from '../components/auth-page-shell';
import { AuthForm } from '../components/auth-form';
export default function Login() {
  const description = 'برای ادامه، شماره همراه و روش ورود را انتخاب کنید.';
  return <AuthPageShell title="خوش آمدید" description={description}>
    <AuthForm />
  </AuthPageShell>;
}
