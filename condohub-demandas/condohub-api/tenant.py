from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    PAPEIS_APROVADORES,
    PAPEIS_GESTORES,
    PAPEIS_VALIDOS,
    UsuarioAutenticado,
    usuario_atual,
)
from clerk import buscar_perfil_clerk
from database import pegar_banco
from models import (
    AdministradorPlataforma,
    Condominio,
    MembroCondominio,
    ModuloCondominio,
    SolicitacaoAcesso,
)

CONDOMINIO_PADRAO_SLUG = "camila-barbosa"

MODULOS_POR_PREFIXO = {
    "/ocorrencias": "chamados", "/mensagens": "chamados", "/notificacoes": "chamados",
    "/reservas": "agendamentos", "/atas": "atas", "/documentos-financeiros": "financeiro", "/acompanhamento": "acompanhamento",
    "/pedidos-compra": "compras", "/estoque": "estoque", "/prestadores": "prestadores",
    "/cronogramas": "cronogramas", "/patrimonios": "patrimonio",
}
MODULOS_VISIVEIS_A_MORADORES = {"chamados", "agendamentos", "atas", "financeiro", "acompanhamento"}


@dataclass(frozen=True)
class ContextoCondominio:
    id: str
    nome: str
    avatar_url: str | None
    papeis: frozenset[str]
    condominio_id: int
    condominio_slug: str
    condominio_nome: str
    membro_id: int


def _papeis_membro(membro: MembroCondominio) -> frozenset[str]:
    return frozenset(
        papel
        for papel in membro.papeis.split(",")
        if papel in PAPEIS_VALIDOS
    )


def _buscar_condominio(banco: Session, slug: str) -> Condominio:
    condominio = (
        banco.query(Condominio)
        .filter(Condominio.slug == slug, Condominio.ativo == 1)
        .first()
    )
    if not condominio:
        raise HTTPException(status_code=404, detail="Condomínio não encontrado.")
    return condominio


def condominio_publico(
    banco: Annotated[Session, Depends(pegar_banco)],
    condominio_slug: Annotated[
        str | None,
        Header(alias="X-Condominio-Slug"),
    ] = None,
) -> Condominio:
    return _buscar_condominio(
        banco,
        condominio_slug or CONDOMINIO_PADRAO_SLUG,
    )


def contexto_condominio(
    request: Request,
    usuario: Annotated[UsuarioAutenticado, Depends(usuario_atual)],
    banco: Annotated[Session, Depends(pegar_banco)],
    condominio_slug: Annotated[
        str | None,
        Header(alias="X-Condominio-Slug"),
    ] = None,
) -> ContextoCondominio:
    slug = condominio_slug or CONDOMINIO_PADRAO_SLUG
    condominio = _buscar_condominio(banco, slug)
    membro = (
        banco.query(MembroCondominio)
        .filter(
            MembroCondominio.condominio_id == condominio.id,
            MembroCondominio.clerk_user_id == usuario.id,
            MembroCondominio.status == "ativo",
        )
        .first()
    )

    if not membro:
        perfil = buscar_perfil_clerk(usuario.id)
        solicitacao = (
            banco.query(SolicitacaoAcesso)
            .filter(
                SolicitacaoAcesso.condominio_id == condominio.id,
                SolicitacaoAcesso.email == perfil.email,
                SolicitacaoAcesso.status == "aprovada",
            )
            .order_by(SolicitacaoAcesso.decidido_em.desc())
            .first()
            if perfil.email
            else None
        )
        papeis_iniciais = (
            {solicitacao.tipo}
            if solicitacao
            else (
                set(usuario.papeis)
                if slug == CONDOMINIO_PADRAO_SLUG
                else set()
            )
        )
        if papeis_iniciais:
            membro = MembroCondominio(
                condominio_id=condominio.id,
                clerk_user_id=usuario.id,
                nome=perfil.nome,
                avatar_url=perfil.avatar_url,
                papeis=",".join(sorted(papeis_iniciais)),
                bloco=solicitacao.bloco if solicitacao else None,
                apartamento=solicitacao.apartamento if solicitacao else None,
                status="ativo",
            )
            banco.add(membro)
            try:
                banco.commit()
                banco.refresh(membro)
            except IntegrityError:
                banco.rollback()
                membro = (
                    banco.query(MembroCondominio)
                    .filter(
                        MembroCondominio.condominio_id == condominio.id,
                        MembroCondominio.clerk_user_id == usuario.id,
                        MembroCondominio.status == "ativo",
                    )
                    .first()
                )

    if not membro:
        raise HTTPException(
            status_code=403,
            detail="Usuário não pertence a este condomínio.",
        )

    if slug == CONDOMINIO_PADRAO_SLUG and "admin" in usuario.papeis:
        admin_plataforma = (
            banco.query(AdministradorPlataforma)
            .filter(AdministradorPlataforma.clerk_user_id == usuario.id)
            .first()
        )
        if not admin_plataforma:
            banco.add(AdministradorPlataforma(clerk_user_id=usuario.id))
            try:
                banco.commit()
            except IntegrityError:
                banco.rollback()

    papeis = _papeis_membro(membro)
    if not papeis:
        raise HTTPException(
            status_code=403,
            detail="Usuário sem papel ativo neste condomínio.",
        )
    modulo = next((chave for prefixo, chave in MODULOS_POR_PREFIXO.items() if request.url.path.startswith(prefixo)), None)
    if modulo:
        configuracao = banco.query(ModuloCondominio).filter(
            ModuloCondominio.condominio_id == condominio.id,
            ModuloCondominio.chave == modulo,
        ).first()
        if not configuracao or not configuracao.habilitado:
            raise HTTPException(status_code=403, detail="Este módulo não está disponível para o condomínio.")
        if papeis.isdisjoint(PAPEIS_GESTORES) and modulo in MODULOS_VISIVEIS_A_MORADORES and not configuracao.visivel_moradores:
            raise HTTPException(status_code=403, detail="Este módulo não está visível para os moradores.")
    return ContextoCondominio(
        id=usuario.id,
        nome=membro.nome,
        avatar_url=membro.avatar_url,
        papeis=papeis,
        condominio_id=condominio.id,
        condominio_slug=condominio.slug,
        condominio_nome=condominio.nome,
        membro_id=membro.id,
    )


def exigir_morador(
    contexto: Annotated[ContextoCondominio, Depends(contexto_condominio)],
) -> ContextoCondominio:
    if "morador" not in contexto.papeis:
        raise HTTPException(
            status_code=403,
            detail="Reservas disponíveis somente para moradores.",
        )
    return contexto


def exigir_gestor(
    contexto: Annotated[ContextoCondominio, Depends(contexto_condominio)],
) -> ContextoCondominio:
    if contexto.papeis.isdisjoint(PAPEIS_GESTORES):
        raise HTTPException(status_code=403, detail="Acesso restrito à gestão.")
    return contexto


def exigir_aprovador(
    contexto: Annotated[ContextoCondominio, Depends(contexto_condominio)],
) -> ContextoCondominio:
    if contexto.papeis.isdisjoint(PAPEIS_APROVADORES):
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito ao síndico e ao administrador.",
        )
    return contexto


def exigir_admin(
    contexto: Annotated[ContextoCondominio, Depends(contexto_condominio)],
) -> ContextoCondominio:
    if "admin" not in contexto.papeis:
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito ao administrador.",
        )
    return contexto


def exigir_admin_plataforma(
    usuario: Annotated[UsuarioAutenticado, Depends(usuario_atual)],
    banco: Annotated[Session, Depends(pegar_banco)],
) -> UsuarioAutenticado:
    existe = (
        banco.query(AdministradorPlataforma)
        .filter(AdministradorPlataforma.clerk_user_id == usuario.id)
        .first()
    )
    if not existe:
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito à administração da plataforma.",
        )
    return usuario
