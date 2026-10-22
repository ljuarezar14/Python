import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Ingresa a PyRaíz" description="Accede a tu cuenta para guardar tu progreso y retomarlo desde cualquier dispositivo.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
