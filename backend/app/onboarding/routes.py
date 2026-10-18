"""Authenticated read and update of onboarding answers."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.identity.models import User
from app.identity.routes import DbSession, current_user, trusted_origin
from app.onboarding.models import UserProfile
from app.onboarding.rules import recommend
from app.onboarding.schemas import OnboardingAnswers, OnboardingResponse

router = APIRouter()


def response_for(profile: UserProfile) -> OnboardingResponse:
    answers = OnboardingAnswers(
        goal=profile.goal,
        experience=profile.experience,
        weekly_minutes=profile.weekly_minutes,
        interests=profile.interests,
        example_context=profile.example_context,
        known_topics=profile.known_topics,
    )
    return OnboardingResponse(**answers.model_dump(), recommendation=recommend(answers))


@router.get("", response_model=OnboardingResponse)
def get_onboarding(
    db: DbSession, user: Annotated[User, Depends(current_user)]
) -> OnboardingResponse:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Completa el cuestionario para empezar")
    return response_for(profile)


@router.put("", response_model=OnboardingResponse)
def put_onboarding(
    answers: OnboardingAnswers,
    db: DbSession,
    user: Annotated[User, Depends(current_user)],
    _: Annotated[None, Depends(trusted_origin)],
) -> OnboardingResponse:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    profile.goal = answers.goal
    profile.experience = answers.experience
    profile.weekly_minutes = answers.weekly_minutes
    profile.interests = list(answers.interests)
    profile.example_context = answers.example_context
    profile.known_topics = list(answers.known_topics)
    db.commit()
    return response_for(profile)
