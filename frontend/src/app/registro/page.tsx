import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell title="Crea tu cuenta" description="Guarda tu avance cuando las rutas y lecciones estén disponibles. Registrarte es gratuito.">
      <AuthForm mode="register" />
    </AuthShell>
  );
}
