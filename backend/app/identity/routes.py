"""Versioned registration, login, logout, and current-user endpoints."""

import time
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.identity.models import AuthSession, User
from app.identity.security import dummy_hash, hash_token, new_token, password_hasher

router = APIRouter()
COOKIE_NAME = "pyraiz_session"


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: str


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]


def trusted_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed = set(request.app.state.settings.cors_origins)
    allowed.add(request.app.state.settings.api_origin)
    if origin not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origen no permitido")


def throttle(request: Request) -> None:
    address = request.client.host if request.client else "unknown"
    key = f"{request.url.path}:{address}"
    if not request.app.state.rate_limiter.allow(key):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Espera un minuto.")


def public_user(user: User) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, role=user.role)


def issue_session(request: Request, response: Response, db: Session, user: User) -> None:
    token = new_token()
    lifetime = request.app.state.settings.session_seconds
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= int(time.time())))
    db.add(
        AuthSession(
            user_id=user.id, token_hash=hash_token(token), expires_at=int(time.time()) + lifetime
        )
    )
    db.commit()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=lifetime,
        httponly=True,
        secure=request.app.state.settings.cookie_secure,
        samesite="lax",
        path="/api/v1",
    )


def current_user(request: Request, db: DbSession) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar")
    row = db.execute(
        select(User)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(
            AuthSession.token_hash == hash_token(token), AuthSession.expires_at > int(time.time())
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=401, detail="Sesión no válida o vencida")
    return row


@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    credentials: Credentials,
    request: Request,
    response: Response,
    db: DbSession,
    _: Annotated[None, Depends(trusted_origin)],
    __: Annotated[None, Depends(throttle)],
) -> UserResponse:
    email = str(credentials.email).casefold()
    user = User(
        email=email, password_hash=password_hasher.hash(credentials.password), role="student"
    )
    db.add(user)
    try:
        db.flush()
        issue_session(request, response, db, user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="No se pudo registrar esta cuenta") from error
    return public_user(user)


@router.post("/login", response_model=UserResponse)
def login(
    credentials: Credentials,
    request: Request,
    response: Response,
    db: DbSession,
    _: Annotated[None, Depends(trusted_origin)],
    __: Annotated[None, Depends(throttle)],
) -> UserResponse:
    user = db.scalar(select(User).where(User.email == str(credentials.email).casefold()))
    password_hash = user.password_hash if user else dummy_hash
    valid = password_hasher.verify(credentials.password, password_hash)
    if not user or not valid:
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    issue_session(request, response, db, user)
    return public_user(user)


@router.get("/me", response_model=UserResponse)
def me(user: Annotated[User, Depends(current_user)]) -> UserResponse:
    return public_user(user)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    db: DbSession,
    _: Annotated[None, Depends(trusted_origin)],
) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        db.commit()
    response.delete_cookie(key=COOKIE_NAME, path="/api/v1")
