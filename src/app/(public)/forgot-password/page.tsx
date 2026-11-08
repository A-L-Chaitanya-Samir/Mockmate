import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "Password recovery" };
export default function Page() {
  return <AuthForm mode="forgot" />;
}
