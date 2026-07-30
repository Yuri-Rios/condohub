import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from enum import Enum

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware

from auth import PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS
from tenant import (
    ContextoCondominio,
    condominio_publico,
    contexto_condominio,
    exigir_admin,
    exigir_admin_plataforma,
    exigir_aprovador,
    exigir_gestor,
    exigir_morador,
)
from clerk import buscar_perfil_clerk
from database import Base, engine, pegar_banco
from migrations_runner import aplicar_migracoes_multitenant
from models import (
    AdministradorPlataforma,
    Condominio,
    FUSO_BRASIL,
    MembroCondominio,
    MensagemOcorrencia,
    Ocorrencia,
    ReacaoMensagem,
    ReservaAmbiente,
    SolicitacaoAcesso,
)
from schemas import (
    CondominioCriar,
    OcorrenciaCriar,
    OcorrenciaDetalhe,
    OcorrenciaResposta,
    MensagemCriar,
    MensagemResposta,
    ReacaoAlternar,
    ReservaCriar,
    ReservaReagendar,
    ReservaResposta,
    StatusOcorrenciaAlterar,
    SolicitacaoAcessoCriar,
    SolicitacaoAcessoResposta,
    SolicitacaoConfirmarConvite,
    SolicitacaoRecusar,
)

logger = logging.getLogger(__name__)


class EstadoInicializacao(str, Enum):
    INICIANDO = "iniciando"
    PRONTO = "pronto"
    ERRO = "erro"


estado_inicializacao = EstadoInicializacao.INICIANDO
erro_inicializacao: str | None = None
ATRASOS_INICIALIZACAO = (0, 2, 5, 10, 20, 30)
VERSAO_WAKEUP = "browser-direct-v5"


def inicializar_banco():
    global estado_inicializacao, erro_inicializacao

    for tentativa, atraso in enumerate(ATRASOS_INICIALIZACAO, start=1):
        if atraso:
            time.sleep(atraso)
        try:
            Base.metadata.create_all(bind=engine)
            aplicar_migracoes_multitenant(engine)
        except Exception as erro:
            engine.dispose()
            erro_inicializacao = type(erro).__name__
            if tentativa == len(ATRASOS_INICIALIZACAO):
                estado_inicializacao = EstadoInicializacao.ERRO
                logger.exception(
                    "Falha definitiva ao inicializar o banco de dados"
                )
                return
            logger.warning(
                "Banco indisponível na tentativa %s; nova tentativa agendada",
                tentativa,
                exc_info=True,
            )
        else:
            estado_inicializacao = EstadoInicializacao.PRONTO
            erro_inicializacao = None
            return


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Não bloqueia a abertura da porta do Render enquanto o Neon desperta e as
    # migrações são verificadas. As rotas de negócio permanecem indisponíveis
    # até a inicialização terminar.
    tarefa = asyncio.create_task(asyncio.to_thread(inicializar_banco))
    yield
    if not tarefa.done():
        tarefa.cancel()


app = FastAPI(lifespan=lifespan)

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


@app.middleware("http")
async def aguardar_inicializacao(request: Request, call_next):
    if (
        request.url.path not in {"/", "/health"}
        and estado_inicializacao != EstadoInicializacao.PRONTO
    ):
        return JSONResponse(
            {
                "detail": (
                    "Banco de dados inicializando."
                    if estado_inicializacao == EstadoInicializacao.INICIANDO
                    else "Falha ao inicializar o banco de dados."
                ),
                "status": estado_inicializacao,
            },
            status_code=503,
            headers={"Retry-After": "5"},
        )
    return await call_next(request)


@app.get("/")
def inicio():
    return {
        "mensagem": "API de ocorrências funcionando",
        "status": estado_inicializacao,
        "wakeup": VERSAO_WAKEUP,
    }


@app.get("/health")
def health():
    if estado_inicializacao == EstadoInicializacao.INICIANDO:
        return JSONResponse(
            {
                "status": estado_inicializacao,
                "wakeup": VERSAO_WAKEUP,
            },
            status_code=503,
            headers={"Retry-After": "5"},
        )
    if estado_inicializacao == EstadoInicializacao.ERRO:
        return JSONResponse(
            {
                "status": estado_inicializacao,
                "erro": erro_inicializacao,
                "wakeup": VERSAO_WAKEUP,
            },
            status_code=503,
            headers={"Retry-After": "30"},
        )
    return {"status": "ok", "wakeup": VERSAO_WAKEUP}


def _validar_data_reserva(inicio: datetime):
    agora = datetime.now(FUSO_BRASIL)
    inicio_local = inicio.astimezone(FUSO_BRASIL)
    if inicio_local <= agora:
        raise HTTPException(
            status_code=422,
            detail="Escolha um horário futuro.",
        )
    if inicio_local > agora + timedelta(days=90):
        raise HTTPException(
            status_code=422,
            detail="As reservas podem ser feitas com até 90 dias de antecedência.",
        )


def _reserva_resposta(
    reserva: ReservaAmbiente,
    usuario: ContextoCondominio,
):
    minha = reserva.morador_id == usuario.id
    return {
        "id": reserva.id if minha else None,
        "ambiente": reserva.ambiente,
        "inicio": reserva.inicio,
        "fim": reserva.fim,
        "minha": minha,
    }


@app.get("/reservas", response_model=list[ReservaResposta])
def listar_reservas(
    inicio: datetime,
    fim: datetime,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_morador),
):
    if inicio.tzinfo is None or fim.tzinfo is None or fim <= inicio:
        raise HTTPException(status_code=422, detail="Período inválido.")
    if fim - inicio > timedelta(days=14):
        raise HTTPException(
            status_code=422,
            detail="Consulte no máximo duas semanas por vez.",
        )

    reservas = (
        banco.query(ReservaAmbiente)
        .filter(
            ReservaAmbiente.inicio >= inicio,
            ReservaAmbiente.inicio < fim,
            ReservaAmbiente.condominio_id == usuario.condominio_id,
        )
        .order_by(ReservaAmbiente.inicio.asc())
        .all()
    )
    return [_reserva_resposta(reserva, usuario) for reserva in reservas]


@app.post("/reservas", response_model=ReservaResposta, status_code=201)
def criar_reserva(
    dados: ReservaCriar,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_morador),
):
    _validar_data_reserva(dados.inicio)
    reserva = ReservaAmbiente(
        condominio_id=usuario.condominio_id,
        ambiente=dados.ambiente,
        inicio=dados.inicio,
        fim=dados.inicio + timedelta(hours=2),
        morador_id=usuario.id,
        morador_nome=usuario.nome,
    )
    banco.add(reserva)
    try:
        banco.commit()
    except IntegrityError as erro:
        banco.rollback()
        raise HTTPException(
            status_code=409,
            detail="Este horário acabou de ser reservado.",
        ) from erro
    banco.refresh(reserva)
    return _reserva_resposta(reserva, usuario)


@app.patch("/reservas/{reserva_id}", response_model=ReservaResposta)
def reagendar_reserva(
    reserva_id: int,
    dados: ReservaReagendar,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_morador),
):
    reserva = (
        banco.query(ReservaAmbiente)
        .filter(
            ReservaAmbiente.id == reserva_id,
            ReservaAmbiente.condominio_id == usuario.condominio_id,
        )
        .first()
    )
    if not reserva or reserva.morador_id != usuario.id:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    _validar_data_reserva(dados.inicio)
    reserva.inicio = dados.inicio
    reserva.fim = dados.inicio + timedelta(hours=2)
    try:
        banco.commit()
    except IntegrityError as erro:
        banco.rollback()
        raise HTTPException(
            status_code=409,
            detail="Este horário acabou de ser reservado.",
        ) from erro
    banco.refresh(reserva)
    return _reserva_resposta(reserva, usuario)


@app.delete("/reservas/{reserva_id}", status_code=204)
def cancelar_reserva(
    reserva_id: int,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_morador),
):
    reserva = (
        banco.query(ReservaAmbiente)
        .filter(
            ReservaAmbiente.id == reserva_id,
            ReservaAmbiente.condominio_id == usuario.condominio_id,
        )
        .first()
    )
    if not reserva or reserva.morador_id != usuario.id:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    banco.delete(reserva)
    banco.commit()


@app.get("/ocorrencias", response_model=list[OcorrenciaResposta])
def listar_ocorrencias(
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    ocorrencias = (
        banco.query(Ocorrencia)
        .filter(Ocorrencia.condominio_id == usuario.condominio_id)
        .order_by(Ocorrencia.id.desc())
        .all()
    )
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
            "pode_editar": item.autor_id == usuario.id,
        }
        for item in ocorrencias
    ]


@app.post("/ocorrencias", response_model=OcorrenciaResposta)
def criar_ocorrencia(
    dados: OcorrenciaCriar,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    nova_ocorrencia = Ocorrencia(
        condominio_id=usuario.condominio_id,
        titulo=dados.titulo,
        local=dados.local,
        descricao=dados.descricao,
        autor_id=usuario.id,
        autor_nome=usuario.nome,
        autor_avatar_url=usuario.avatar_url,
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
        "pode_editar": True,
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
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    ocorrencia = (
        banco.query(Ocorrencia)
        .filter(
            Ocorrencia.id == ocorrencia_id,
            Ocorrencia.condominio_id == usuario.condominio_id,
        )
        .first()
    )
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
        "pode_editar": ocorrencia.autor_id == usuario.id,
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
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    ocorrencia = (
        banco.query(Ocorrencia)
        .filter(
            Ocorrencia.id == ocorrencia_id,
            Ocorrencia.condominio_id == usuario.condominio_id,
        )
        .first()
    )
    if not ocorrencia:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    mensagem = MensagemOcorrencia(
        ocorrencia_id=ocorrencia_id,
        conteudo=dados.conteudo,
        autor_id=usuario.id,
        autor_nome=usuario.nome,
        autor_avatar_url=usuario.avatar_url,
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
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    ocorrencia = (
        banco.query(Ocorrencia)
        .filter(
            Ocorrencia.id == ocorrencia_id,
            Ocorrencia.condominio_id == usuario.condominio_id,
        )
        .first()
    )
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
        "pode_editar": ocorrencia.autor_id == usuario.id,
    }


@app.post("/mensagens/{mensagem_id}/reacoes")
def alternar_reacao(
    mensagem_id: int,
    dados: ReacaoAlternar,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    mensagem = (
        banco.query(MensagemOcorrencia)
        .join(Ocorrencia, Ocorrencia.id == MensagemOcorrencia.ocorrencia_id)
        .filter(
            MensagemOcorrencia.id == mensagem_id,
            Ocorrencia.condominio_id == usuario.condominio_id,
        )
        .first()
    )
    if not mensagem:
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
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    ocorrencia = (
        banco.query(Ocorrencia)
        .filter(
            Ocorrencia.id == ocorrencia_id,
            Ocorrencia.condominio_id == usuario.condominio_id,
        )
        .first()
    )

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")
    if ocorrencia.autor_id != usuario.id:
        raise HTTPException(
            status_code=403,
            detail="Somente o autor pode editar este chamado.",
        )

    ocorrencia.titulo = dados.titulo
    ocorrencia.local = dados.local
    ocorrencia.descricao = dados.descricao

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
        "pode_editar": True,
    }


@app.delete("/ocorrencias/{ocorrencia_id}", status_code=204)
def excluir_ocorrencia(
    ocorrencia_id: int,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_admin),
):
    ocorrencia = (
        banco.query(Ocorrencia)
        .filter(
            Ocorrencia.id == ocorrencia_id,
            Ocorrencia.condominio_id == usuario.condominio_id,
        )
        .first()
    )
    if not ocorrencia:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    banco.delete(ocorrencia)
    banco.commit()


@app.get("/me")
def meus_dados(
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    admin_plataforma = (
        banco.query(AdministradorPlataforma)
        .filter(AdministradorPlataforma.clerk_user_id == usuario.id)
        .first()
        is not None
    )
    return {
        "id": usuario.id,
        "papeis": sorted(usuario.papeis),
        "admin_plataforma": admin_plataforma,
        "condominio": {
            "id": usuario.condominio_id,
            "slug": usuario.condominio_slug,
            "nome": usuario.condominio_nome,
        },
    }


@app.get("/condominios")
def listar_meus_condominios(
    banco: Session = Depends(pegar_banco),
    contexto: ContextoCondominio = Depends(contexto_condominio),
):
    membros = (
        banco.query(MembroCondominio, Condominio)
        .join(Condominio, Condominio.id == MembroCondominio.condominio_id)
        .filter(
            MembroCondominio.clerk_user_id == contexto.id,
            MembroCondominio.status == "ativo",
            Condominio.ativo == 1,
        )
        .order_by(Condominio.nome.asc())
        .all()
    )
    return [
        {
            "id": condominio.id,
            "nome": condominio.nome,
            "slug": condominio.slug,
            "papeis": sorted(
                papel
                for papel in membro.papeis.split(",")
                if papel
            ),
        }
        for membro, condominio in membros
    ]


@app.get("/moradores")
def listar_moradores(
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    membros = (
        banco.query(MembroCondominio)
        .filter(MembroCondominio.condominio_id == usuario.condominio_id)
        .order_by(
            MembroCondominio.bloco.asc(),
            MembroCondominio.apartamento.asc(),
            MembroCondominio.nome.asc(),
        )
        .all()
    )
    return [
        {
            "id": membro.id,
            "nome": membro.nome,
            "avatar_url": membro.avatar_url,
            "bloco": membro.bloco,
            "apartamento": membro.apartamento,
            "papeis": sorted(
                papel for papel in membro.papeis.split(",") if papel
            ),
            "status": membro.status,
            "criado_em": membro.criado_em,
        }
        for membro in membros
        if "morador" in membro.papeis.split(",")
    ]


@app.get("/condominio-publico")
def obter_condominio_publico(
    condominio: Condominio = Depends(condominio_publico),
):
    return {
        "id": condominio.id,
        "nome": condominio.nome,
        "slug": condominio.slug,
    }


@app.get("/admin/condominios")
def listar_condominios_da_plataforma(
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_admin_plataforma),
):
    return [
        {
            "id": item.id,
            "nome": item.nome,
            "slug": item.slug,
            "ativo": item.ativo == 1,
        }
        for item in banco.query(Condominio).order_by(Condominio.nome.asc()).all()
    ]


@app.post("/admin/condominios", status_code=201)
def criar_condominio(
    dados: CondominioCriar,
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(exigir_admin_plataforma),
):
    if banco.query(Condominio).filter(Condominio.slug == dados.slug).first():
        raise HTTPException(
            status_code=409,
            detail="Já existe um condomínio com este endereço.",
        )

    perfil = buscar_perfil_clerk(usuario.id)
    condominio = Condominio(nome=dados.nome, slug=dados.slug, ativo=1)
    banco.add(condominio)
    banco.flush()
    banco.add(
        MembroCondominio(
            condominio_id=condominio.id,
            clerk_user_id=usuario.id,
            nome=perfil.nome,
            avatar_url=perfil.avatar_url,
            papeis="admin,sindico",
            status="ativo",
        )
    )
    banco.commit()
    banco.refresh(condominio)
    return {
        "id": condominio.id,
        "nome": condominio.nome,
        "slug": condominio.slug,
        "ativo": True,
    }


@app.post("/solicitacoes-acesso", response_model=SolicitacaoAcessoResposta)
def solicitar_acesso(
    dados: SolicitacaoAcessoCriar,
    banco: Session = Depends(pegar_banco),
    condominio: Condominio = Depends(condominio_publico),
):
    existente = (
        banco.query(SolicitacaoAcesso)
        .filter(
            SolicitacaoAcesso.email == str(dados.email).lower(),
            SolicitacaoAcesso.condominio_id == condominio.id,
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
        condominio_id=condominio.id,
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
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    return (
        banco.query(SolicitacaoAcesso)
        .filter(SolicitacaoAcesso.condominio_id == usuario.condominio_id)
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
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    solicitacao = (
        banco.query(SolicitacaoAcesso)
        .filter(
            SolicitacaoAcesso.id == solicitacao_id,
            SolicitacaoAcesso.condominio_id == usuario.condominio_id,
        )
        .first()
    )
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
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    solicitacao = (
        banco.query(SolicitacaoAcesso)
        .filter(
            SolicitacaoAcesso.id == solicitacao_id,
            SolicitacaoAcesso.condominio_id == usuario.condominio_id,
        )
        .first()
    )
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if solicitacao.status != "pendente":
        raise HTTPException(status_code=409, detail="Solicitação já decidida.")

    solicitacao.status = "aprovada"
    solicitacao.decidido_em = datetime.now(FUSO_BRASIL)
    solicitacao.decidido_por = usuario.id
    solicitacao.clerk_invitation_id = dados.invitation_id
    if dados.clerk_user_id:
        membro = (
            banco.query(MembroCondominio)
            .filter(
                MembroCondominio.condominio_id == usuario.condominio_id,
                MembroCondominio.clerk_user_id == dados.clerk_user_id,
            )
            .first()
        )
        perfil = buscar_perfil_clerk(dados.clerk_user_id)
        if membro:
            papeis = set(membro.papeis.split(","))
            papeis.add(solicitacao.tipo)
            membro.papeis = ",".join(sorted(papel for papel in papeis if papel))
            membro.status = "ativo"
            membro.nome = perfil.nome
            membro.avatar_url = perfil.avatar_url
            if solicitacao.bloco:
                membro.bloco = solicitacao.bloco
            if solicitacao.apartamento:
                membro.apartamento = solicitacao.apartamento
        else:
            banco.add(
                MembroCondominio(
                    condominio_id=usuario.condominio_id,
                    clerk_user_id=dados.clerk_user_id,
                    nome=perfil.nome,
                    avatar_url=perfil.avatar_url,
                    papeis=solicitacao.tipo,
                    bloco=solicitacao.bloco,
                    apartamento=solicitacao.apartamento,
                    status="ativo",
                )
            )
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
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    solicitacao = (
        banco.query(SolicitacaoAcesso)
        .filter(
            SolicitacaoAcesso.id == solicitacao_id,
            SolicitacaoAcesso.condominio_id == usuario.condominio_id,
        )
        .first()
    )
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
