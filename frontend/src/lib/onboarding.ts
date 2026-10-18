export type Goal = "explore" | "build" | "automate" | "innovate";
export type Experience = "none" | "some" | "comfortable";
export type Interest = "finance" | "education" | "work" | "data" | "environment" | "web";
export type ExampleContext = "daily" | "academic" | "work" | "community";
export type KnownTopic = "variables" | "conditionals" | "functions";
export type WeeklyMinutes = 15 | 30 | 60 | 120 | 180;

export type OnboardingAnswers = {
  goal: Goal | "";
  experience: Experience | "";
  weekly_minutes: WeeklyMinutes | 0;
  interests: Interest[];
  example_context: ExampleContext | "";
  known_topics: KnownTopic[];
};

export type Recommendation = {
  starting_point: string;
  focus: string;
  suggested_theme: string;
  reason: string;
  weekly_plan: string;
  example_project: string;
  rule_version: number;
};

export type OnboardingResult = OnboardingAnswers & { recommendation: Recommendation };

export const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: "explore", label: "Explorar", description: "Quiero aprender a programar desde cero." },
  { value: "build", label: "Construir", description: "Quiero crear aplicaciones y mejorar mis bases." },
  { value: "automate", label: "Automatizar", description: "Quiero ahorrar tiempo en tareas repetitivas." },
  { value: "innovate", label: "Innovar", description: "Me interesan los datos y nuevas tecnologías." },
];

export const EXPERIENCES: { value: Experience; label: string }[] = [
  { value: "none", label: "Estoy empezando desde cero" },
  { value: "some", label: "He probado algo de programación" },
  { value: "comfortable", label: "Ya he programado y conozco conceptos básicos" },
];

export const INTERESTS: { value: Interest; label: string }[] = [
  { value: "finance", label: "Finanzas personales" },
  { value: "education", label: "Educación" },
  { value: "work", label: "Trabajo y emprendimiento" },
  { value: "data", label: "Datos" },
  { value: "environment", label: "Medio ambiente" },
  { value: "web", label: "Aplicaciones web" },
];

export const CONTEXTS: { value: ExampleContext; label: string }[] = [
  { value: "daily", label: "Vida cotidiana" },
  { value: "academic", label: "Estudios" },
  { value: "work", label: "Trabajo" },
  { value: "community", label: "Comunidad" },
];

export const TOPICS: { value: KnownTopic; label: string }[] = [
  { value: "variables", label: "Variables" },
  { value: "conditionals", label: "Condicionales" },
  { value: "functions", label: "Funciones" },
];
