import { AccountPanel } from "@/components/account-panel";
import { AuthShell } from "@/components/auth-shell";

export default function AccountPage() {
  return (
    <AuthShell title="Tu cuenta" description="Consulta tu sesión y vuelve cuando publiquemos las primeras actividades.">
      <AccountPanel />
    </AuthShell>
  );
}
