import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Ingresa a PyRaíz" description="Accede a tu cuenta. Las primeras lecciones llegarán en una siguiente etapa.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
