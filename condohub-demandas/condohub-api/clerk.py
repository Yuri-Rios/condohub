import os
from dataclasses import dataclass

import httpx
from fastapi import HTTPException


@dataclass(frozen=True)
class PerfilClerk:
    nome: str
    avatar_url: str | None
    email: str | None


def buscar_perfil_clerk(usuario_id: str) -> PerfilClerk:
    chave = os.getenv("CLERK_SECRET_KEY")
    if not chave:
        raise HTTPException(
            status_code=503,
            detail="Consulta de usuários do Clerk não configurada na API.",
        )

    try:
        resposta = httpx.get(
            f"https://api.clerk.com/v1/users/{usuario_id}",
            headers={"Authorization": f"Bearer {chave}"},
            timeout=8,
        )
        resposta.raise_for_status()
    except httpx.HTTPError as erro:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar o perfil do usuário.",
        ) from erro

    dados = resposta.json()
    nome = " ".join(
        parte
        for parte in [dados.get("first_name"), dados.get("last_name")]
        if parte
    ).strip()
    if not nome:
        nome = dados.get("username") or "Usuário"

    emails = dados.get("email_addresses") or []
    principal_id = dados.get("primary_email_address_id")
    email_principal = next(
        (
            item.get("email_address")
            for item in emails
            if item.get("id") == principal_id
        ),
        None,
    )
    return PerfilClerk(
        nome=nome,
        avatar_url=dados.get("image_url"),
        email=email_principal.lower() if email_principal else None,
    )
