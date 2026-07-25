import os
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

PAPEIS_VALIDOS = {
    "morador",
    "sindico",
    "subsindico",
    "funcionario",
    "admin",
}
PAPEIS_GESTORES = {"sindico", "subsindico", "funcionario", "admin"}
PAPEIS_APROVADORES = {"sindico", "admin"}

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "").rstrip("/")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE")

esquema_bearer = HTTPBearer(auto_error=False)
jwks_client = (
    PyJWKClient(f"{CLERK_ISSUER}/.well-known/jwks.json")
    if CLERK_ISSUER
    else None
)


@dataclass(frozen=True)
class UsuarioAutenticado:
    id: str
    papeis: frozenset[str]


def _papeis_do_token(payload: dict) -> frozenset[str]:
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        return frozenset()

    papeis = metadata.get("roles")
    if isinstance(papeis, list):
        validos = {papel for papel in papeis if papel in PAPEIS_VALIDOS}
        return frozenset(validos)

    papel_antigo = metadata.get("role")
    return frozenset(
        {papel_antigo} if papel_antigo in PAPEIS_VALIDOS else set()
    )


def usuario_atual(
    credenciais: Annotated[
        HTTPAuthorizationCredentials | None, Depends(esquema_bearer)
    ],
) -> UsuarioAutenticado:
    if not CLERK_ISSUER or jwks_client is None:
        raise HTTPException(
            status_code=503,
            detail="Autenticação ainda não configurada no servidor.",
        )

    if credenciais is None or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sessão não informada.")

    try:
        chave = jwks_client.get_signing_key_from_jwt(credenciais.credentials)
        payload = jwt.decode(
            credenciais.credentials,
            chave.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            audience=CLERK_AUDIENCE,
            options={"verify_aud": bool(CLERK_AUDIENCE)},
        )
    except jwt.PyJWTError as erro:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.") from erro

    usuario_id = payload.get("sub")
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Sessão sem usuário.")

    return UsuarioAutenticado(id=usuario_id, papeis=_papeis_do_token(payload))


def exigir_gestor(
    usuario: Annotated[UsuarioAutenticado, Depends(usuario_atual)],
) -> UsuarioAutenticado:
    if usuario.papeis.isdisjoint(PAPEIS_GESTORES):
        raise HTTPException(status_code=403, detail="Acesso restrito à gestão.")
    return usuario


def exigir_usuario_aprovado(
    usuario: Annotated[UsuarioAutenticado, Depends(usuario_atual)],
) -> UsuarioAutenticado:
    if not usuario.papeis:
        raise HTTPException(
            status_code=403,
            detail="Usuário ainda não aprovado pelo condomínio.",
        )
    return usuario


def exigir_aprovador(
    usuario: Annotated[UsuarioAutenticado, Depends(usuario_atual)],
) -> UsuarioAutenticado:
    if usuario.papeis.isdisjoint(PAPEIS_APROVADORES):
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito ao síndico e ao administrador.",
        )
    return usuario
