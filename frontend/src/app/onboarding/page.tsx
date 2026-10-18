import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "@/components/onboarding-form";

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Encuentra tu punto de partida"
      description="Cuéntanos qué quieres lograr y cuánto tiempo tienes. Podrás cambiar tus respuestas cuando quieras."
    >
      <OnboardingForm />
    </AuthShell>
  );
}
