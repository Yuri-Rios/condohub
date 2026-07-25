from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware

from auth import (
    PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS,
    UsuarioAutenticado,
    exigir_admin,
    exigir_aprovador,
    exigir_gestor,
    exigir_usuario_aprovado,
)
from clerk import buscar_perfil_clerk
from database import Base, SessionLocal, engine
from models import (
    FUSO_BRASIL,
    MensagemOcorrencia,
    Ocorrencia,
    ReacaoMensagem,
    SolicitacaoAcesso,
)
from schemas import (
    OcorrenciaCriar,
    OcorrenciaDetalhe,
    OcorrenciaResposta,
    MensagemCriar,
    MensagemResposta,
    ReacaoAlternar,
    StatusOcorrenciaAlterar,
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
    usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    ocorrencias = banco.query(Ocorrencia).order_by(Ocorrencia.id.desc()).all()
    pode_ver_autor = not usuario.papeis.isdisjoint(
        PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS
    )
    return [
        {
            "id": item.id,
            "titulo": item.titulo,
            "local": item.local,
            "descricao": item.descricao,
            "status": item.status,
            "data_solicitacao": item.data_solicitacao,
            "autor_nome": item.autor_nome if pode_ver_autor else None,
        }
        for item in ocorrencias
    ]


@app.post("/ocorrencias", response_model=OcorrenciaResposta)
def criar_ocorrencia(
    dados: OcorrenciaCriar,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    perfil = buscar_perfil_clerk(usuario.id)
    nova_ocorrencia = Ocorrencia(
        titulo=dados.titulo,
        local=dados.local,
        descricao=dados.descricao,
        autor_id=usuario.id,
        autor_nome=perfil.nome,
        autor_avatar_url=perfil.avatar_url,
    )

    banco.add(nova_ocorrencia)
    banco.commit()
    banco.refresh(nova_ocorrencia)

    return {
        "id": nova_ocorrencia.id,
        "titulo": nova_ocorrencia.titulo,
        "local": nova_ocorrencia.local,
        "descricao": nova_ocorrencia.descricao,
        "status": nova_ocorrencia.status,
        "data_solicitacao": nova_ocorrencia.data_solicitacao,
        "autor_nome": None,
    }


def _mensagem_resposta(
    mensagem: MensagemOcorrencia,
    reacoes: list[ReacaoMensagem] | None = None,
    usuario_id: str | None = None,
):
    resumo_reacoes: dict[str, dict] = {}
    for reacao in reacoes or []:
        resumo = resumo_reacoes.setdefault(
            reacao.emoji,
            {"emoji": reacao.emoji, "quantidade": 0, "minha": False},
        )
        resumo["quantidade"] += 1
        if reacao.usuario_id == usuario_id:
            resumo["minha"] = True

    return {
        "id": mensagem.id,
        "ocorrencia_id": mensagem.ocorrencia_id,
        "conteudo": mensagem.conteudo,
        "autor_id": mensagem.autor_id,
        "autor_nome": mensagem.autor_nome,
        "autor_avatar_url": mensagem.autor_avatar_url,
        "autor_papeis": [
            papel for papel in mensagem.autor_papeis.split(",") if papel
        ],
        "criado_em": mensagem.criado_em,
        "reacoes": list(resumo_reacoes.values()),
    }


@app.get("/ocorrencias/{ocorrencia_id}/thread", response_model=OcorrenciaDetalhe)
def obter_thread(
    ocorrencia_id: int,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    ocorrencia = banco.get(Ocorrencia, ocorrencia_id)
    if not ocorrencia:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    mensagens = (
        banco.query(MensagemOcorrencia)
        .filter(MensagemOcorrencia.ocorrencia_id == ocorrencia_id)
        .order_by(MensagemOcorrencia.criado_em.asc())
        .all()
    )
    ids_mensagens = [mensagem.id for mensagem in mensagens]
    reacoes = (
        banco.query(ReacaoMensagem)
        .filter(ReacaoMensagem.mensagem_id.in_(ids_mensagens))
        .all()
        if ids_mensagens
        else []
    )
    reacoes_por_mensagem: dict[int, list[ReacaoMensagem]] = {}
    for reacao in reacoes:
        reacoes_por_mensagem.setdefault(reacao.mensagem_id, []).append(reacao)
    pode_ver_autor = not usuario.papeis.isdisjoint(
        PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS
    )
    pode_alterar_status = not usuario.papeis.isdisjoint(
        PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS
    )
    pode_reabrir = (
        ocorrencia.status == "fechado"
        and ocorrencia.autor_id == usuario.id
        and not usuario.papeis.isdisjoint({"morador", "funcionario"})
    )
    return {
        "id": ocorrencia.id,
        "titulo": ocorrencia.titulo,
        "local": ocorrencia.local,
        "descricao": ocorrencia.descricao,
        "status": ocorrencia.status,
        "data_solicitacao": ocorrencia.data_solicitacao,
        "autor_nome": ocorrencia.autor_nome if pode_ver_autor else None,
        "autor_avatar_url": (
            ocorrencia.autor_avatar_url if pode_ver_autor else None
        ),
        "pode_alterar_status": pode_alterar_status,
        "pode_reabrir": pode_reabrir,
        "mensagens": [
            _mensagem_resposta(
                item,
                reacoes_por_mensagem.get(item.id, []),
                usuario.id,
            )
            for item in mensagens
        ],
    }


@app.post(
    "/ocorrencias/{ocorrencia_id}/mensagens",
    response_model=MensagemResposta,
)
def criar_mensagem(
    ocorrencia_id: int,
    dados: MensagemCriar,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    if not banco.get(Ocorrencia, ocorrencia_id):
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    perfil = buscar_perfil_clerk(usuario.id)
    mensagem = MensagemOcorrencia(
        ocorrencia_id=ocorrencia_id,
        conteudo=dados.conteudo,
        autor_id=usuario.id,
        autor_nome=perfil.nome,
        autor_avatar_url=perfil.avatar_url,
        autor_papeis=",".join(sorted(usuario.papeis)),
    )
    banco.add(mensagem)
    banco.commit()
    banco.refresh(mensagem)
    return _mensagem_resposta(mensagem)


@app.patch("/ocorrencias/{ocorrencia_id}/status", response_model=OcorrenciaResposta)
def alterar_status_ocorrencia(
    ocorrencia_id: int,
    dados: StatusOcorrenciaAlterar,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    ocorrencia = banco.get(Ocorrencia, ocorrencia_id)
    if not ocorrencia:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    pode_gerenciar = not usuario.papeis.isdisjoint(
        PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS
    )
    pode_reabrir_proprio = (
        ocorrencia.status == "fechado"
        and dados.status == "novo"
        and ocorrencia.autor_id == usuario.id
        and not usuario.papeis.isdisjoint({"morador", "funcionario"})
    )
    if not pode_gerenciar and not pode_reabrir_proprio:
        raise HTTPException(
            status_code=403,
            detail="Você não pode alterar o status deste chamado.",
        )

    ocorrencia.status = dados.status
    banco.commit()
    banco.refresh(ocorrencia)
    return {
        "id": ocorrencia.id,
        "titulo": ocorrencia.titulo,
        "local": ocorrencia.local,
        "descricao": ocorrencia.descricao,
        "status": ocorrencia.status,
        "data_solicitacao": ocorrencia.data_solicitacao,
        "autor_nome": (
            ocorrencia.autor_nome
            if not usuario.papeis.isdisjoint(
                PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS
            )
            else None
        ),
    }


@app.post("/mensagens/{mensagem_id}/reacoes")
def alternar_reacao(
    mensagem_id: int,
    dados: ReacaoAlternar,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_usuario_aprovado),
):
    if not banco.get(MensagemOcorrencia, mensagem_id):
        raise HTTPException(status_code=404, detail="Mensagem não encontrada.")

    existente = (
        banco.query(ReacaoMensagem)
        .filter(
            ReacaoMensagem.mensagem_id == mensagem_id,
            ReacaoMensagem.usuario_id == usuario.id,
            ReacaoMensagem.emoji == dados.emoji,
        )
        .first()
    )
    if existente:
        banco.delete(existente)
        ativa = False
    else:
        banco.add(
            ReacaoMensagem(
                mensagem_id=mensagem_id,
                usuario_id=usuario.id,
                emoji=dados.emoji,
            )
        )
        ativa = True

    banco.commit()
    quantidade = (
        banco.query(ReacaoMensagem)
        .filter(
            ReacaoMensagem.mensagem_id == mensagem_id,
            ReacaoMensagem.emoji == dados.emoji,
        )
        .count()
    )
    return {"emoji": dados.emoji, "quantidade": quantidade, "minha": ativa}

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


@app.delete("/ocorrencias/{ocorrencia_id}", status_code=204)
def excluir_ocorrencia(
    ocorrencia_id: int,
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_admin),
):
    ocorrencia = banco.get(Ocorrencia, ocorrencia_id)
    if not ocorrencia:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    banco.delete(ocorrencia)
    banco.commit()


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
