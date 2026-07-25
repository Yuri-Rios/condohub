from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware

from auth import (
    UsuarioAutenticado,
    exigir_aprovador,
    exigir_gestor,
    exigir_usuario_aprovado,
)
from database import Base, SessionLocal, engine
from models import FUSO_BRASIL, Ocorrencia, SolicitacaoAcesso
from schemas import (
    OcorrenciaCriar,
    OcorrenciaResposta,
    SolicitacaoAcessoCriar,
    SolicitacaoAcessoResposta,
    SolicitacaoConfirmarConvite,
    SolicitacaoRecusar,
)

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://condohub-app.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def pegar_banco():
    banco = SessionLocal()

    try:
        yield banco
    finally:
        banco.close()


@app.get("/")
def inicio():
    return {"mensagem": "API de ocorrências funcionando"}


@app.get("/ocorrencias", response_model=list[OcorrenciaResposta])
def listar_ocorrencias(
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    ocorrencias = banco.query(Ocorrencia).order_by(Ocorrencia.id.desc()).all()
    return ocorrencias


@app.post("/ocorrencias", response_model=OcorrenciaResposta)
def criar_ocorrencia(
    dados: OcorrenciaCriar,
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    nova_ocorrencia = Ocorrencia(
        titulo=dados.titulo,
        local=dados.local,
        descricao=dados.descricao,
    )

    banco.add(nova_ocorrencia)
    banco.commit()
    banco.refresh(nova_ocorrencia)

    return nova_ocorrencia

@app.put("/ocorrencias/{ocorrencia_id}", response_model=OcorrenciaResposta)
def atualizar_ocorrencia(
    ocorrencia_id: int,
    dados: OcorrenciaCriar,
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_gestor),
):
    ocorrencia = banco.query(Ocorrencia).filter(Ocorrencia.id == ocorrencia_id).first()

    if ocorrencia is None:
        return {"erro": "Ocorrência não encontrada"}

    ocorrencia.titulo = dados.titulo
    ocorrencia.local = dados.local
    ocorrencia.descricao = dados.descricao

    banco.commit()
    banco.refresh(ocorrencia)

    return ocorrencia


@app.get("/me")
def meus_dados(usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado)):
    return {"id": usuario.id, "papeis": sorted(usuario.papeis)}


@app.post("/solicitacoes-acesso", response_model=SolicitacaoAcessoResposta)
def solicitar_acesso(
    dados: SolicitacaoAcessoCriar,
    banco: Session = Depends(pegar_banco),
):
    existente = (
        banco.query(SolicitacaoAcesso)
        .filter(
            SolicitacaoAcesso.email == str(dados.email).lower(),
            SolicitacaoAcesso.status.in_(["pendente", "aprovada"]),
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=409,
            detail="Já existe uma solicitação para este e-mail.",
        )

    solicitacao = SolicitacaoAcesso(
        nome=dados.nome,
        email=str(dados.email).lower(),
        tipo=dados.tipo,
        bloco=dados.bloco.strip() if dados.bloco else None,
        apartamento=dados.apartamento.strip() if dados.apartamento else None,
        observacao=dados.observacao.strip() if dados.observacao else None,
    )
    banco.add(solicitacao)
    banco.commit()
    banco.refresh(solicitacao)
    return solicitacao


@app.get("/solicitacoes-acesso", response_model=list[SolicitacaoAcessoResposta])
def listar_solicitacoes(
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_aprovador),
):
    return (
        banco.query(SolicitacaoAcesso)
        .order_by(SolicitacaoAcesso.criado_em.desc())
        .all()
    )


@app.get(
    "/solicitacoes-acesso/{solicitacao_id}",
    response_model=SolicitacaoAcessoResposta,
)
def obter_solicitacao(
    solicitacao_id: int,
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_aprovador),
):
    solicitacao = banco.get(SolicitacaoAcesso, solicitacao_id)
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    return solicitacao


@app.post(
    "/solicitacoes-acesso/{solicitacao_id}/confirmar",
    response_model=SolicitacaoAcessoResposta,
)
def confirmar_solicitacao(
    solicitacao_id: int,
    dados: SolicitacaoConfirmarConvite,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_aprovador),
):
    solicitacao = banco.get(SolicitacaoAcesso, solicitacao_id)
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if solicitacao.status != "pendente":
        raise HTTPException(status_code=409, detail="Solicitação já decidida.")

    solicitacao.status = "aprovada"
    solicitacao.decidido_em = datetime.now(FUSO_BRASIL)
    solicitacao.decidido_por = usuario.id
    solicitacao.clerk_invitation_id = dados.invitation_id
    banco.commit()
    banco.refresh(solicitacao)
    return solicitacao


@app.post(
    "/solicitacoes-acesso/{solicitacao_id}/recusar",
    response_model=SolicitacaoAcessoResposta,
)
def recusar_solicitacao(
    solicitacao_id: int,
    dados: SolicitacaoRecusar,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_aprovador),
):
    solicitacao = banco.get(SolicitacaoAcesso, solicitacao_id)
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if solicitacao.status != "pendente":
        raise HTTPException(status_code=409, detail="Solicitação já decidida.")

    solicitacao.status = "recusada"
    solicitacao.decidido_em = datetime.now(FUSO_BRASIL)
    solicitacao.decidido_por = usuario.id
    solicitacao.motivo_recusa = dados.motivo.strip()
    banco.commit()
    banco.refresh(solicitacao)
    return solicitacao
