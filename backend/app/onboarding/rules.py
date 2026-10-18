"""Transparent, deterministic recommendations without unverified skipping."""

from app.onboarding.schemas import OnboardingAnswers, Recommendation

TOPICS = {
    "variables": "variables",
    "conditionals": "condicionales",
    "functions": "funciones",
}
FOCUS = {
    "explore": "Comprender Python con problemas cotidianos",
    "build": "Construir aplicaciones paso a paso",
    "automate": "Automatizar tareas repetitivas",
    "innovate": "Explorar datos y tecnología aplicada",
}
THEMES = {
    "finance": "Finanzas personales",
    "education": "Educación",
    "work": "Trabajo y emprendimiento",
    "data": "Análisis de datos",
    "environment": "Medio ambiente",
    "web": "Aplicaciones web",
}
STUDY_PLAN = {
    15: "Una sesión de 15 minutos por semana",
    30: "Dos sesiones de 15 minutos por semana",
    60: "Tres sesiones de 20 minutos por semana",
    120: "Cuatro sesiones de 30 minutos por semana",
    180: "Seis sesiones de 30 minutos por semana",
}
EXAMPLE_PROJECT = {
    "daily": "Presupuesto personal",
    "academic": "Registro de notas",
    "work": "Reporte automático",
    "community": "Resumen de datos ambientales",
}


def recommend(answers: OnboardingAnswers) -> Recommendation:
    missing = [name for topic, name in TOPICS.items() if topic not in answers.known_topics]
    if answers.experience == "none":
        reason = (
            "Como estás empezando desde cero, te recomendamos comenzar por Fundamentos de Python. "
            "El cuestionario no verifica competencias ni salta lecciones."
        )
    elif missing:
        topic_list = ", ".join(missing[:-1]) + (" y " if len(missing) > 1 else "") + missing[-1]
        reason = (
            "Te recomendamos comenzar por Fundamentos de Python porque todavía no has indicado "
            f"práctica con {topic_list}."
        )
    else:
        reason = (
            "Te recomendamos repasar Fundamentos de Python y realizar un diagnóstico opcional "
            "cuando esté disponible. El cuestionario no verifica competencias ni salta lecciones."
        )
    return Recommendation(
        starting_point="Fundamentos de Python",
        focus=FOCUS[answers.goal],
        suggested_theme=THEMES[answers.interests[0]],
        reason=reason,
        weekly_plan=STUDY_PLAN[answers.weekly_minutes],
        example_project=EXAMPLE_PROJECT[answers.example_context],
        rule_version=1,
    )
