import asyncio
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from enum import Enum

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse, Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware

from auth import PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS, UsuarioAutenticado, usuario_atual
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
    AnexoPedidoCompra,
    AnexoOcorrencia,
    Ata,
    Condominio,
    DocumentoFinanceiro,
    Cronograma,
    EtapaCronograma,
    EtapaModeloCronograma,
    FUSO_BRASIL,
    MembroCondominio,
    ModeloCronograma,
    ModuloCondominio,
    MensagemOcorrencia,
    AtendimentoPrestador,
    HistoricoPedidoCompra,
    ItemEstoque,
    IntegracaoOneDrive,
    MovimentoEstoque,
    Patrimonio,
    FotoPatrimonio,
    NotificacaoOcorrencia,
    Ocorrencia,
    PedidoCompra,
    PrestadorServico,
    ReacaoMensagem,
    ReservaAmbiente,
    SolicitacaoAcesso,
)
from schemas import (
    CondominioCriar,
    DocumentoFinanceiroAtualizar,
    ModuloHabilitacao,
    ModuloVisibilidade,
    CronogramaCriar,
    CronogramaPublicacao,
    EtapaCronogramaStatus,
    ModeloCronogramaCriar,
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
    AtendimentoPrestadorCriar,
    ItemEstoqueCriar,
    MovimentoEstoqueCriar,
    PatrimonioCriar,
    PedidoCompraCriar,
    PedidoCompraStatus,
    PrestadorCriar,
    SolicitacaoAcessoCriar,
    SolicitacaoAcessoResposta,
    SolicitacaoAtualizarConvite,
    SolicitacaoConfirmarConvite,
    SolicitacaoRecusar,
    AtaAtualizar,
    PastaOneDriveConfigurar,
    PastaDocumentoCriar,
)
from onedrive import (
    obter_url_download,
    criar_estado,
    criar_caminho_pastas,
    criptografar_token,
    ler_estado,
    listar_arquivos,
    listar_pastas,
    listar_conteudo,
    obter_perfil_drive,
    renovar_token,
    resolver_pasta,
    enviar_arquivo,
    trocar_codigo,
    url_autorizacao,
)
from storage import obter_storage

logger = logging.getLogger(__name__)


class EstadoInicializacao(str, Enum):
    INICIANDO = "iniciando"
    PRONTO = "pronto"
    ERRO = "erro"


estado_inicializacao = EstadoInicializacao.INICIANDO
erro_inicializacao: str | None = None
ATRASOS_INICIALIZACAO = (0, 2, 5, 10, 20, 30)
VERSAO_WAKEUP = "browser-direct-v5"
CATALOGO_MODULOS = (
    ("chamados", "Ocorrências", True),
    ("agendamentos", "Agendamentos", True),
    ("atas", "Atas", True),
    ("financeiro", "Balancetes e orçamentos", True),
    ("contratos", "Contratos", True),
    ("certificados", "Certificados", True),
    ("memorial", "Memorial", True),
    ("acompanhamento", "Acompanhamento", True),
    ("compras", "Compras", False),
    ("estoque", "Estoque", False),
    ("patrimonio", "Patrimônio", False),
    ("prestadores", "Prestadores", False),
    ("cronogramas", "Cronogramas", False),
)


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


def _integracao_onedrive(banco: Session, condominio_id: int) -> IntegracaoOneDrive:
    integracao = banco.query(IntegracaoOneDrive).filter(IntegracaoOneDrive.condominio_id == condominio_id).first()
    if not integracao:
        raise HTTPException(status_code=404, detail="OneDrive ainda não conectado.")
    return integracao


def _integracao_resposta(integracao: IntegracaoOneDrive | None):
    if not integracao:
        return {"conectada": False}
    return {
        "conectada": integracao.status == "ativa",
        "status": integracao.status,
        "email": integracao.microsoft_email,
        "pasta": integracao.root_path,
        "pastas": {
            "atas": integracao.root_path,
            "balancete": integracao.balancetes_root_path,
            "orcamento": integracao.orcamentos_root_path,
            "contrato": integracao.contratos_root_path,
            "certificado": integracao.certificados_root_path,
            "memorial": integracao.memoriais_root_path,
        },
        "ultima_sincronizacao_em": integracao.ultima_sincronizacao_em,
        "erro_ultima_sincronizacao": integracao.erro_ultima_sincronizacao,
    }


def _raiz_documento(integracao: IntegracaoOneDrive, tipo: str) -> tuple[str | None, str | None]:
    return {
        "atas": (integracao.root_item_id, integracao.root_path),
        "balancete": (integracao.balancetes_root_item_id, integracao.balancetes_root_path),
        "orcamento": (integracao.orcamentos_root_item_id, integracao.orcamentos_root_path),
        "contrato": (integracao.contratos_root_item_id, integracao.contratos_root_path),
        "certificado": (integracao.certificados_root_item_id, integracao.certificados_root_path),
        "memorial": (integracao.memoriais_root_item_id, integracao.memoriais_root_path),
    }.get(tipo, (None, None))


def _ata_resposta(ata: Ata, pode_gerenciar: bool):
    return {
        "id": ata.id,
        "titulo": ata.titulo,
        "tipo": ata.tipo,
        "data_assembleia": ata.data_assembleia,
        "descricao": ata.descricao,
        "nome_arquivo": ata.nome_arquivo,
        "caminho_relativo": ata.caminho_relativo,
        "mime_type": ata.mime_type,
        "tamanho": ata.tamanho,
        "modificado_em": ata.modificado_em,
        "publicada": ata.publicada,
        "pode_gerenciar": pode_gerenciar,
    }


def _metadados_iniciais_ata(nome_arquivo: str):
    base = nome_arquivo.rsplit(".", 1)[0]
    titulo = re.sub(r"[_-]+", " ", base).strip()
    normalizado = titulo.lower()
    tipo = "assembleia"
    if "extraordin" in normalizado or re.search(r"\bage\b", normalizado):
        tipo = "assembleia_extraordinaria"
    elif "ordin" in normalizado or re.search(r"\bago\b", normalizado):
        tipo = "assembleia_ordinaria"
    elif "conselho" in normalizado:
        tipo = "reuniao_conselho"
    data = None
    correspondencia = re.search(r"(?<!\d)(\d{2})[-_.](\d{2})[-_.](\d{4})(?!\d)", base)
    if correspondencia:
        try:
            data = datetime(int(correspondencia[3]), int(correspondencia[2]), int(correspondencia[1]), 12, tzinfo=FUSO_BRASIL)
        except ValueError:
            pass
    if not data:
        correspondencia = re.search(r"(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)", base)
        if correspondencia:
            try:
                data = datetime(int(correspondencia[1]), int(correspondencia[2]), int(correspondencia[3]), 12, tzinfo=FUSO_BRASIL)
            except ValueError:
                pass
    return titulo, tipo, data


@app.get("/integracoes/onedrive")
def obter_integracao_onedrive(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    integracao = banco.query(IntegracaoOneDrive).filter(IntegracaoOneDrive.condominio_id == usuario.condominio_id).first()
    return _integracao_resposta(integracao)


@app.post("/integracoes/onedrive/conectar")
def conectar_onedrive(usuario: ContextoCondominio = Depends(exigir_aprovador)):
    return {"authorization_url": url_autorizacao(criar_estado(usuario.condominio_id, usuario.id))}


@app.get("/integracoes/onedrive/callback")
def callback_onedrive(code: str | None = None, state: str | None = None, error: str | None = None, banco: Session = Depends(pegar_banco)):
    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")
    destino = f"{app_url}/administracao/onedrive"
    if error or not code or not state:
        return RedirectResponse(f"{destino}?onedrive=erro")
    estado = ler_estado(state)
    condominio_id = int(estado["condominio_id"])
    membro = banco.query(MembroCondominio).filter(
        MembroCondominio.condominio_id == condominio_id,
        MembroCondominio.clerk_user_id == estado["usuario_id"],
        MembroCondominio.status == "ativo",
    ).first()
    if not membro or set(membro.papeis.split(",")).isdisjoint({"sindico", "admin"}):
        raise HTTPException(status_code=403, detail="Usuário sem permissão para conectar o OneDrive.")
    tokens = trocar_codigo(code)
    perfil, drive = obter_perfil_drive(tokens["access_token"])
    raiz = resolver_pasta(tokens["access_token"], "/")
    integracao = banco.query(IntegracaoOneDrive).filter(IntegracaoOneDrive.condominio_id == condominio_id).first()
    if not integracao:
        integracao = IntegracaoOneDrive(condominio_id=condominio_id)
        banco.add(integracao)
    integracao.microsoft_account_id = perfil["id"]
    integracao.microsoft_email = perfil.get("mail") or perfil.get("userPrincipalName")
    integracao.drive_id = drive["id"]
    integracao.root_item_id = raiz["id"]
    integracao.root_path = "/"
    integracao.refresh_token_criptografado = criptografar_token(tokens["refresh_token"])
    integracao.escopos = tokens.get("scope", "")
    integracao.status = "ativa"
    integracao.conectado_por = estado["usuario_id"]
    integracao.conectado_em = datetime.now(FUSO_BRASIL)
    integracao.erro_ultima_sincronizacao = None
    banco.commit()
    return RedirectResponse(f"{destino}?onedrive=conectado")


@app.put("/integracoes/onedrive/pasta")
def configurar_pasta_onedrive(dados: PastaOneDriveConfigurar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    token = renovar_token(integracao)
    pasta = resolver_pasta(token, dados.caminho)
    integracao.root_item_id = pasta["id"]
    integracao.root_path = dados.caminho
    integracao.status = "ativa"
    integracao.erro_ultima_sincronizacao = None
    banco.commit()
    return _integracao_resposta(integracao)


@app.put("/integracoes/onedrive/pastas/{tipo}")
def configurar_pasta_documento(tipo: str, dados: PastaOneDriveConfigurar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    if tipo not in {"balancete", "orcamento", "contrato", "certificado", "memorial"}:
        raise HTTPException(404, detail="Tipo de documento inválido.")
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    pasta = resolver_pasta(renovar_token(integracao), dados.caminho)
    if tipo == "balancete":
        integracao.balancetes_root_item_id = pasta["id"]
        integracao.balancetes_root_path = dados.caminho
    elif tipo == "orcamento":
        integracao.orcamentos_root_item_id = pasta["id"]
        integracao.orcamentos_root_path = dados.caminho
    elif tipo == "contrato":
        integracao.contratos_root_item_id = pasta["id"]
        integracao.contratos_root_path = dados.caminho
    elif tipo == "certificado":
        integracao.certificados_root_item_id = pasta["id"]
        integracao.certificados_root_path = dados.caminho
    else:
        integracao.memoriais_root_item_id = pasta["id"]
        integracao.memoriais_root_path = dados.caminho
    integracao.status = "ativa"; integracao.erro_ultima_sincronizacao = None
    banco.commit()
    return _integracao_resposta(integracao)


@app.get("/integracoes/onedrive/pastas")
def navegar_pastas_onedrive(caminho: str = "/", banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    token = renovar_token(integracao)
    pasta = resolver_pasta(token, caminho)
    resultado = listar_pastas(token, integracao.drive_id, pasta["id"])
    banco.commit()
    return {"caminho": caminho, "pastas": resultado}


@app.get("/documentos/{tipo}/estrutura")
def estrutura_documentos(tipo: str, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    pasta_id, _ = _raiz_documento(integracao, tipo)
    if not pasta_id:
        raise HTTPException(422, "Pasta não configurada.")
    _, pastas = listar_conteudo(renovar_token(integracao), integracao.drive_id, pasta_id)
    banco.commit()
    return {"pastas": pastas}


@app.post("/documentos/pastas", status_code=201)
def criar_pasta_documento(dados: PastaDocumentoCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    _, raiz = _raiz_documento(integracao, dados.tipo)
    if not raiz:
        raise HTTPException(422, "Pasta não configurada.")
    relativo = "/".join(parte for parte in [dados.caminho_pai, dados.nome] if parte)
    caminho = "/".join(parte.strip("/") for parte in [raiz, relativo] if parte.strip("/"))
    pasta = criar_caminho_pastas(renovar_token(integracao), integracao.drive_id, "/" + caminho)
    banco.commit()
    return {"id": pasta["id"], "caminho": relativo}


@app.post("/documentos/{tipo}/arquivo", status_code=201)
async def enviar_arquivo_documento(tipo: str, caminho: str = Form(default=""), arquivo: UploadFile = File(...), banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    _, raiz = _raiz_documento(integracao, tipo)
    if not raiz or tipo not in {"atas", "balancete", "orcamento", "contrato", "certificado", "memorial"}:
        raise HTTPException(422, "Pasta ou tipo de documento inválido.")
    relativo = caminho.strip().strip("/")
    if ".." in relativo.split("/"):
        raise HTTPException(422, "Caminho inválido.")
    conteudo = await arquivo.read()
    if len(conteudo) > 25 * 1024 * 1024:
        raise HTTPException(413, "O arquivo deve ter no máximo 25 MB.")
    caminho_destino = "/".join(parte.strip("/") for parte in [raiz, relativo] if parte.strip("/"))
    token = renovar_token(integracao)
    pasta = criar_caminho_pastas(token, integracao.drive_id, "/" + caminho_destino)
    item = enviar_arquivo(token, integracao.drive_id, pasta["id"], arquivo.filename or "arquivo", conteudo, arquivo.content_type or "application/octet-stream")
    modificado = datetime.fromisoformat(item["lastModifiedDateTime"].replace("Z", "+00:00")) if item.get("lastModifiedDateTime") else None
    if tipo == "atas":
        titulo, subtipo, data_assembleia = _metadados_iniciais_ata(arquivo.filename or "arquivo")
        banco.add(Ata(condominio_id=usuario.condominio_id, titulo=titulo, tipo=subtipo, data_assembleia=data_assembleia,
            drive_id=integracao.drive_id, drive_item_id=item["id"], nome_arquivo=arquivo.filename or "arquivo", caminho_relativo=relativo,
            mime_type=arquivo.content_type, tamanho=len(conteudo), etag=item.get("eTag"), modificado_em=modificado, publicada=False))
    else:
        titulo, competencia = _metadados_documento_financeiro(arquivo.filename or "arquivo")
        banco.add(DocumentoFinanceiro(condominio_id=usuario.condominio_id, tipo=tipo, titulo=titulo, competencia=competencia,
            drive_id=integracao.drive_id, drive_item_id=item["id"], nome_arquivo=arquivo.filename or "arquivo", caminho_relativo=relativo,
            mime_type=arquivo.content_type, tamanho=len(conteudo), etag=item.get("eTag"), modificado_em=modificado, publicado=False))
    banco.commit()
    return {"id": item["id"], "nome": arquivo.filename, "caminho": relativo}


@app.delete("/integracoes/onedrive", status_code=204)
def desconectar_onedrive(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    banco.delete(integracao)
    banco.commit()


@app.post("/atas/sincronizar")
def sincronizar_atas(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    try:
        token = renovar_token(integracao)
        arquivos = listar_arquivos(token, integracao.drive_id, integracao.root_item_id)
        importados = atualizados = 0
        extensoes = {".pdf", ".doc", ".docx"}
        for arquivo in arquivos:
            nome = arquivo.get("name", "")
            if not any(nome.lower().endswith(extensao) for extensao in extensoes):
                continue
            ata = banco.query(Ata).filter(Ata.condominio_id == usuario.condominio_id, Ata.drive_id == integracao.drive_id, Ata.drive_item_id == arquivo["id"]).first()
            modificado = datetime.fromisoformat(arquivo["lastModifiedDateTime"].replace("Z", "+00:00")) if arquivo.get("lastModifiedDateTime") else None
            if ata:
                ata.nome_arquivo = nome
                ata.caminho_relativo = arquivo.get("_caminho_relativo", "")
                ata.mime_type = arquivo.get("file", {}).get("mimeType")
                ata.tamanho = arquivo.get("size")
                ata.etag = arquivo.get("eTag")
                ata.modificado_em = modificado
                atualizados += 1
            else:
                titulo, tipo, data_assembleia = _metadados_iniciais_ata(nome)
                banco.add(Ata(
                    condominio_id=usuario.condominio_id,
                    titulo=titulo,
                    tipo=tipo,
                    data_assembleia=data_assembleia,
                    drive_id=integracao.drive_id,
                    drive_item_id=arquivo["id"],
                    nome_arquivo=nome,
                    caminho_relativo=arquivo.get("_caminho_relativo", ""),
                    mime_type=arquivo.get("file", {}).get("mimeType"),
                    tamanho=arquivo.get("size"),
                    etag=arquivo.get("eTag"),
                    modificado_em=modificado,
                    publicada=False,
                ))
                importados += 1
        integracao.ultima_sincronizacao_em = datetime.now(FUSO_BRASIL)
        integracao.erro_ultima_sincronizacao = None
        banco.commit()
        return {"importados": importados, "atualizados": atualizados, "encontrados": len(arquivos)}
    except HTTPException as erro:
        banco.rollback()
        integracao = _integracao_onedrive(banco, usuario.condominio_id)
        if erro.status_code == 401:
            integracao.status = "requer_reconexao"
        integracao.erro_ultima_sincronizacao = str(erro.detail)
        banco.commit()
        raise


@app.get("/atas")
def listar_atas(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "subsindico", "funcionario", "admin"})
    consulta = banco.query(Ata).filter(Ata.condominio_id == usuario.condominio_id)
    if not pode_gerenciar:
        consulta = consulta.filter(Ata.publicada.is_(True))
    atas = consulta.order_by(Ata.data_assembleia.desc().nullslast(), Ata.modificado_em.desc()).all()
    return [_ata_resposta(ata, pode_gerenciar) for ata in atas]


@app.post("/documentos/{tipo}/revisar-todos")
def revisar_todos_documentos(tipo: str, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    agora = datetime.now(FUSO_BRASIL)
    if tipo == "atas":
        documentos = banco.query(Ata).filter(Ata.condominio_id == usuario.condominio_id, Ata.publicada.is_(False)).all()
        for documento in documentos:
            documento.publicada = True
            documento.publicado_em = agora
            documento.publicado_por = usuario.id
    elif tipo in {"balancete", "orcamento", "contrato", "certificado", "memorial"}:
        documentos = banco.query(DocumentoFinanceiro).filter(
            DocumentoFinanceiro.condominio_id == usuario.condominio_id,
            DocumentoFinanceiro.tipo == tipo,
            DocumentoFinanceiro.publicado.is_(False),
        ).all()
        for documento in documentos:
            documento.publicado = True
            documento.publicado_em = agora
            documento.publicado_por = usuario.id
    else:
        raise HTTPException(404, "Tipo de documento inválido.")
    banco.commit()
    return {"revisados": len(documentos)}


@app.put("/atas/{ata_id}")
def atualizar_ata(ata_id: int, dados: AtaAtualizar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    ata = banco.query(Ata).filter(Ata.id == ata_id, Ata.condominio_id == usuario.condominio_id).first()
    if not ata:
        raise HTTPException(status_code=404, detail="Ata não encontrada.")
    estava_publicada = ata.publicada
    ata.titulo = dados.titulo
    ata.tipo = dados.tipo
    ata.data_assembleia = dados.data_assembleia
    ata.descricao = dados.descricao
    ata.publicada = dados.publicada
    if dados.publicada and not estava_publicada:
        ata.publicado_em = datetime.now(FUSO_BRASIL)
        ata.publicado_por = usuario.id
    elif not dados.publicada:
        ata.publicado_em = None
        ata.publicado_por = None
    banco.commit()
    banco.refresh(ata)
    return _ata_resposta(ata, True)


@app.get("/atas/{ata_id}/arquivo")
def obter_arquivo_ata(ata_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    ata = banco.query(Ata).filter(Ata.id == ata_id, Ata.condominio_id == usuario.condominio_id).first()
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "subsindico", "funcionario", "admin"})
    if not ata or (not ata.publicada and not pode_gerenciar):
        raise HTTPException(status_code=404, detail="Ata não encontrada.")
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    url = obter_url_download(renovar_token(integracao), ata.drive_id, ata.drive_item_id)
    banco.commit()
    return RedirectResponse(url=url, status_code=302, headers={"Cache-Control": "no-store"})


def _documento_financeiro_resposta(documento: DocumentoFinanceiro, pode_gerenciar: bool):
    return {"id": documento.id, "tipo": documento.tipo, "titulo": documento.titulo,
            "competencia": documento.competencia, "descricao": documento.descricao,
            "nome_arquivo": documento.nome_arquivo, "caminho_relativo": documento.caminho_relativo, "mime_type": documento.mime_type,
            "tamanho": documento.tamanho, "modificado_em": documento.modificado_em,
            "publicado": documento.publicado, "pode_gerenciar": pode_gerenciar}


def _exigir_modulo_documento(tipo: str, banco: Session, usuario: ContextoCondominio):
    chave = {"balancete": "financeiro", "orcamento": "financeiro", "contrato": "contratos",
             "certificado": "certificados", "memorial": "memorial"}[tipo]
    modulo = banco.query(ModuloCondominio).filter(
        ModuloCondominio.condominio_id == usuario.condominio_id, ModuloCondominio.chave == chave).first()
    if not modulo or not modulo.habilitado:
        raise HTTPException(403, "Este módulo não está disponível para o condomínio.")
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "subsindico", "funcionario", "admin"})
    if not pode_gerenciar and not modulo.visivel_moradores:
        raise HTTPException(403, "Este módulo não está visível para os moradores.")


def _metadados_documento_financeiro(nome_arquivo: str):
    base = nome_arquivo.rsplit(".", 1)[0]
    titulo = re.sub(r"[_-]+", " ", base).strip()
    competencia = None
    correspondencia = re.search(r"(?<!\d)(\d{2})[-_.](\d{4})(?!\d)", base)
    if correspondencia:
        try: competencia = date(int(correspondencia[2]), int(correspondencia[1]), 1)
        except ValueError: pass
    if not competencia:
        correspondencia = re.search(r"(?<!\d)(\d{4})[-_.](\d{2})(?!\d)", base)
        if correspondencia:
            try: competencia = date(int(correspondencia[1]), int(correspondencia[2]), 1)
            except ValueError: pass
    return titulo, competencia


@app.post("/documentos-financeiros/{tipo}/sincronizar")
def sincronizar_documentos_financeiros(tipo: str, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    rotulos = {"balancete": "balancetes", "orcamento": "orçamentos", "contrato": "contratos", "certificado": "certificados", "memorial": "memoriais"}
    if tipo not in rotulos: raise HTTPException(404, "Tipo de documento inválido.")
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    pastas = {"balancete": integracao.balancetes_root_item_id, "orcamento": integracao.orcamentos_root_item_id,
              "contrato": integracao.contratos_root_item_id, "certificado": integracao.certificados_root_item_id,
              "memorial": integracao.memoriais_root_item_id}
    pasta_id = pastas[tipo]
    if not pasta_id: raise HTTPException(422, f"Configure a pasta de {rotulos[tipo]}.")
    try:
        arquivos = listar_arquivos(renovar_token(integracao), integracao.drive_id, pasta_id)
        importados = atualizados = 0; extensoes = {".pdf", ".doc", ".docx", ".xls", ".xlsx"}
        for arquivo in arquivos:
            nome = arquivo.get("name", "")
            if not any(nome.lower().endswith(extensao) for extensao in extensoes): continue
            documento = banco.query(DocumentoFinanceiro).filter(
                DocumentoFinanceiro.condominio_id == usuario.condominio_id, DocumentoFinanceiro.tipo == tipo,
                DocumentoFinanceiro.drive_id == integracao.drive_id, DocumentoFinanceiro.drive_item_id == arquivo["id"]).first()
            modificado = datetime.fromisoformat(arquivo["lastModifiedDateTime"].replace("Z", "+00:00")) if arquivo.get("lastModifiedDateTime") else None
            if documento:
                documento.nome_arquivo = nome; documento.caminho_relativo = arquivo.get("_caminho_relativo", ""); documento.mime_type = arquivo.get("file", {}).get("mimeType")
                documento.tamanho = arquivo.get("size"); documento.etag = arquivo.get("eTag"); documento.modificado_em = modificado
                atualizados += 1
            else:
                titulo, competencia = _metadados_documento_financeiro(nome)
                banco.add(DocumentoFinanceiro(condominio_id=usuario.condominio_id, tipo=tipo, titulo=titulo,
                    competencia=competencia, drive_id=integracao.drive_id, drive_item_id=arquivo["id"], nome_arquivo=nome,
                    caminho_relativo=arquivo.get("_caminho_relativo", ""),
                    mime_type=arquivo.get("file", {}).get("mimeType"), tamanho=arquivo.get("size"),
                    etag=arquivo.get("eTag"), modificado_em=modificado, publicado=False))
                importados += 1
        integracao.ultima_sincronizacao_em = datetime.now(FUSO_BRASIL); integracao.erro_ultima_sincronizacao = None
        banco.commit()
        return {"importados": importados, "atualizados": atualizados, "encontrados": len(arquivos)}
    except HTTPException as erro:
        banco.rollback(); integracao = _integracao_onedrive(banco, usuario.condominio_id)
        if erro.status_code == 401: integracao.status = "requer_reconexao"
        integracao.erro_ultima_sincronizacao = str(erro.detail); banco.commit(); raise


@app.get("/documentos-financeiros")
def listar_documentos_financeiros(tipo: str, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    if tipo not in {"balancete", "orcamento", "contrato", "certificado", "memorial"}: raise HTTPException(422, "Tipo de documento inválido.")
    _exigir_modulo_documento(tipo, banco, usuario)
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "subsindico", "funcionario", "admin"})
    consulta = banco.query(DocumentoFinanceiro).filter(DocumentoFinanceiro.condominio_id == usuario.condominio_id, DocumentoFinanceiro.tipo == tipo)
    if not pode_gerenciar: consulta = consulta.filter(DocumentoFinanceiro.publicado.is_(True))
    documentos = consulta.order_by(DocumentoFinanceiro.competencia.desc().nullslast(), DocumentoFinanceiro.modificado_em.desc()).all()
    return [_documento_financeiro_resposta(documento, pode_gerenciar) for documento in documentos]


@app.put("/documentos-financeiros/{documento_id}")
def atualizar_documento_financeiro(documento_id: int, dados: DocumentoFinanceiroAtualizar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    documento = banco.query(DocumentoFinanceiro).filter(DocumentoFinanceiro.id == documento_id, DocumentoFinanceiro.condominio_id == usuario.condominio_id).first()
    if not documento: raise HTTPException(404, "Documento não encontrado.")
    estava_publicado = documento.publicado; documento.titulo = dados.titulo; documento.competencia = dados.competencia
    documento.descricao = dados.descricao; documento.publicado = dados.publicado
    if dados.publicado and not estava_publicado: documento.publicado_em = datetime.now(FUSO_BRASIL); documento.publicado_por = usuario.id
    elif not dados.publicado: documento.publicado_em = None; documento.publicado_por = None
    banco.commit(); banco.refresh(documento)
    return _documento_financeiro_resposta(documento, True)


@app.get("/documentos-financeiros/{documento_id}/arquivo")
def obter_arquivo_documento_financeiro(documento_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    documento = banco.query(DocumentoFinanceiro).filter(DocumentoFinanceiro.id == documento_id, DocumentoFinanceiro.condominio_id == usuario.condominio_id).first()
    if documento: _exigir_modulo_documento(documento.tipo, banco, usuario)
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "subsindico", "funcionario", "admin"})
    if not documento or (not documento.publicado and not pode_gerenciar): raise HTTPException(404, "Documento não encontrado.")
    integracao = _integracao_onedrive(banco, usuario.condominio_id)
    url = obter_url_download(renovar_token(integracao), documento.drive_id, documento.drive_item_id); banco.commit()
    return RedirectResponse(url=url, status_code=302, headers={"Cache-Control": "no-store"})


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
    contagens_nao_lidas = dict(
        banco.query(
            NotificacaoOcorrencia.ocorrencia_id,
            func.count(NotificacaoOcorrencia.id),
        )
        .filter(
            NotificacaoOcorrencia.condominio_id == usuario.condominio_id,
            NotificacaoOcorrencia.destinatario_id == usuario.id,
            NotificacaoOcorrencia.lida_em.is_(None),
        )
        .group_by(NotificacaoOcorrencia.ocorrencia_id)
        .all()
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
            "nao_lidas": contagens_nao_lidas.get(item.id, 0),
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
    banco.flush()
    _criar_notificacoes_ocorrencia(
        banco,
        nova_ocorrencia,
        usuario.id,
        "novo_chamado",
    )
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
        "nao_lidas": 0,
    }


PAPEIS_NOTIFICADOS_CHAMADOS = {"sindico", "subsindico", "admin"}


def _criar_notificacoes_ocorrencia(
    banco: Session,
    ocorrencia: Ocorrencia,
    ator_id: str,
    tipo: str,
):
    destinatarios = {
        membro.clerk_user_id
        for membro in banco.query(MembroCondominio)
        .filter(
            MembroCondominio.condominio_id == ocorrencia.condominio_id,
            MembroCondominio.status == "ativo",
        )
        .all()
        if not set(membro.papeis.split(",")).isdisjoint(
            PAPEIS_NOTIFICADOS_CHAMADOS
        )
    }
    if ocorrencia.autor_id:
        destinatarios.add(ocorrencia.autor_id)
    destinatarios.discard(ator_id)

    for destinatario_id in destinatarios:
        banco.add(
            NotificacaoOcorrencia(
                condominio_id=ocorrencia.condominio_id,
                ocorrencia_id=ocorrencia.id,
                destinatario_id=destinatario_id,
                tipo=tipo,
                ator_id=ator_id,
            )
        )


@app.get("/notificacoes-ocorrencias/contagem")
def contar_notificacoes_ocorrencias(
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    quantidade = (
        banco.query(NotificacaoOcorrencia)
        .filter(
            NotificacaoOcorrencia.condominio_id == usuario.condominio_id,
            NotificacaoOcorrencia.destinatario_id == usuario.id,
            NotificacaoOcorrencia.lida_em.is_(None),
        )
        .count()
    )
    return {"quantidade": quantidade}


@app.post("/ocorrencias/{ocorrencia_id}/marcar-lida")
def marcar_ocorrencia_lida(
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

    atualizadas = (
        banco.query(NotificacaoOcorrencia)
        .filter(
            NotificacaoOcorrencia.ocorrencia_id == ocorrencia_id,
            NotificacaoOcorrencia.destinatario_id == usuario.id,
            NotificacaoOcorrencia.lida_em.is_(None),
        )
        .update(
            {NotificacaoOcorrencia.lida_em: datetime.now(FUSO_BRASIL)},
            synchronize_session=False,
        )
    )
    banco.commit()
    return {"atualizadas": atualizadas}


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
    _criar_notificacoes_ocorrencia(
        banco,
        ocorrencia,
        usuario.id,
        "nova_mensagem",
    )
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

    status_anterior = ocorrencia.status
    ocorrencia.status = dados.status
    if status_anterior != dados.status:
        _criar_notificacoes_ocorrencia(
            banco,
            ocorrencia,
            usuario.id,
            "status_alterado",
        )
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


def _pedido_resposta(pedido: PedidoCompra, banco: Session, usuario: ContextoCondominio):
    historico = (
        banco.query(HistoricoPedidoCompra)
        .filter(HistoricoPedidoCompra.pedido_id == pedido.id)
        .order_by(HistoricoPedidoCompra.criado_em.asc())
        .all()
    )
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "admin"})
    pode_editar = pedido.status != "done" and (pedido.solicitante_id == usuario.id or pode_gerenciar)
    anexos = banco.query(AnexoPedidoCompra).filter(AnexoPedidoCompra.pedido_id == pedido.id).order_by(AnexoPedidoCompra.id.asc()).all()
    return {
        "id": pedido.id, "ocorrencia_id": pedido.ocorrencia_id, "item": pedido.item, "quantidade": float(pedido.quantidade),
        "unidade": pedido.unidade, "justificativa": pedido.justificativa,
        "valor_estimado": float(pedido.valor_estimado) if pedido.valor_estimado is not None else None,
        "data_compra": pedido.data_compra,
        "status": pedido.status, "solicitante_nome": pedido.solicitante_nome,
        "criado_em": pedido.criado_em, "atualizado_em": pedido.atualizado_em,
        "pode_gerenciar": pode_gerenciar,
        "pode_editar": pode_editar,
        "pode_excluir": pode_editar,
        "anexos": [{"id": a.id, "nome": a.nome, "mime_type": a.mime_type, "tamanho": a.tamanho,
                    "url": f"/api/pedidos-compra/{pedido.id}/anexos/{a.id}/arquivo"} for a in anexos],
        "historico": [{"id": h.id, "status": h.status, "observacao": h.observacao,
                       "autor_nome": h.autor_nome, "criado_em": h.criado_em} for h in historico],
    }


@app.get("/pedidos-compra")
def listar_pedidos_compra(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    pedidos = banco.query(PedidoCompra).filter(PedidoCompra.condominio_id == usuario.condominio_id).order_by(PedidoCompra.id.desc()).all()
    return [_pedido_resposta(p, banco, usuario) for p in pedidos]


@app.post("/pedidos-compra", status_code=201)
def criar_pedido_compra(dados: PedidoCompraCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    if dados.ocorrencia_id and not banco.query(Ocorrencia).filter(Ocorrencia.id == dados.ocorrencia_id, Ocorrencia.condominio_id == usuario.condominio_id).first():
        raise HTTPException(422, "Chamado inválido.")
    pedido = PedidoCompra(condominio_id=usuario.condominio_id, ocorrencia_id=dados.ocorrencia_id, item=dados.item.strip(), quantidade=dados.quantidade,
                          unidade=dados.unidade.strip(), justificativa=dados.justificativa.strip(), valor_estimado=dados.valor_estimado,
                          data_compra=dados.data_compra,
                          solicitante_id=usuario.id, solicitante_nome=usuario.nome)
    banco.add(pedido); banco.flush()
    banco.add(HistoricoPedidoCompra(pedido_id=pedido.id, status="create", observacao="Pedido criado.", autor_id=usuario.id, autor_nome=usuario.nome))
    banco.commit(); banco.refresh(pedido)
    return _pedido_resposta(pedido, banco, usuario)


@app.put("/pedidos-compra/{pedido_id}")
def editar_pedido_compra(pedido_id: int, dados: PedidoCompraCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    pedido = banco.query(PedidoCompra).filter(PedidoCompra.id == pedido_id, PedidoCompra.condominio_id == usuario.condominio_id).first()
    if not pedido: raise HTTPException(404, "Pedido não encontrado.")
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "admin"})
    if pedido.status == "done" or (pedido.solicitante_id != usuario.id and not pode_gerenciar):
        raise HTTPException(403, "Você não pode editar este pedido.")
    if dados.ocorrencia_id and not banco.query(Ocorrencia).filter(Ocorrencia.id == dados.ocorrencia_id, Ocorrencia.condominio_id == usuario.condominio_id).first():
        raise HTTPException(422, "Chamado inválido.")
    pedido.ocorrencia_id = dados.ocorrencia_id; pedido.item = dados.item.strip()
    pedido.quantidade = dados.quantidade; pedido.unidade = dados.unidade.strip()
    pedido.justificativa = dados.justificativa.strip(); pedido.valor_estimado = dados.valor_estimado; pedido.data_compra = dados.data_compra
    pedido.atualizado_em = datetime.now(FUSO_BRASIL)
    banco.add(HistoricoPedidoCompra(pedido_id=pedido.id, status=pedido.status, observacao="Dados do pedido editados.", autor_id=usuario.id, autor_nome=usuario.nome))
    banco.commit(); banco.refresh(pedido)
    return _pedido_resposta(pedido, banco, usuario)


@app.delete("/pedidos-compra/{pedido_id}", status_code=204)
def excluir_pedido_compra(pedido_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    pedido = banco.query(PedidoCompra).filter(PedidoCompra.id == pedido_id, PedidoCompra.condominio_id == usuario.condominio_id).first()
    if not pedido: raise HTTPException(404, "Pedido não encontrado.")
    pode_gerenciar = not usuario.papeis.isdisjoint({"sindico", "admin"})
    if pedido.status == "done": raise HTTPException(422, "Pedidos concluídos não podem ser excluídos porque já movimentaram o estoque.")
    if pedido.solicitante_id != usuario.id and not pode_gerenciar:
        raise HTTPException(403, "Você não pode excluir este pedido.")
    banco.delete(pedido); banco.commit()


@app.patch("/pedidos-compra/{pedido_id}/status")
def alterar_status_pedido(pedido_id: int, dados: PedidoCompraStatus, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    pedido = banco.query(PedidoCompra).filter(PedidoCompra.id == pedido_id, PedidoCompra.condominio_id == usuario.condominio_id).first()
    if not pedido: raise HTTPException(404, "Pedido não encontrado.")
    status_anterior = pedido.status
    proximo_status = {"create": "ongoing", "ongoing": "done"}.get(status_anterior)
    if dados.status != proximo_status:
        raise HTTPException(422, "Siga o fluxo Criado → Em andamento → Concluído.")
    pedido.status = dados.status; pedido.atualizado_em = datetime.now(FUSO_BRASIL)
    banco.add(HistoricoPedidoCompra(pedido_id=pedido.id, status=dados.status, observacao=dados.observacao,
                                    autor_id=usuario.id, autor_nome=usuario.nome))
    if dados.status == "done" and status_anterior != "done":
        item = banco.query(ItemEstoque).filter(ItemEstoque.condominio_id == usuario.condominio_id,
                                               ItemEstoque.nome == pedido.item,
                                               ItemEstoque.unidade == pedido.unidade).first()
        if not item:
            item = ItemEstoque(condominio_id=usuario.condominio_id, nome=pedido.item,
                               unidade=pedido.unidade, quantidade=0)
            banco.add(item); banco.flush()
        item.quantidade = float(item.quantidade) + float(pedido.quantidade)
        banco.add(MovimentoEstoque(item_id=item.id, tipo="entrada", quantidade=pedido.quantidade,
                                  observacao=f"Entrada automática do pedido #{pedido.id}.", pedido_id=pedido.id,
                                  autor_id=usuario.id, autor_nome=usuario.nome))
    banco.commit(); banco.refresh(pedido)
    return _pedido_resposta(pedido, banco, usuario)


def _item_estoque_resposta(item: ItemEstoque, banco: Session):
    movimentos = banco.query(MovimentoEstoque).filter(MovimentoEstoque.item_id == item.id).order_by(MovimentoEstoque.id.desc()).all()
    datas_compra = {pedido.id: pedido.data_compra for pedido in banco.query(PedidoCompra).filter(
        PedidoCompra.id.in_([m.pedido_id for m in movimentos if m.pedido_id is not None])
    ).all()} if any(m.pedido_id is not None for m in movimentos) else {}
    return {"id": item.id, "nome": item.nome, "unidade": item.unidade, "quantidade": float(item.quantidade),
            "estoque_minimo": float(item.estoque_minimo) if item.estoque_minimo is not None else None,
            "localizacao": item.localizacao, "criado_em": item.criado_em,
            "movimentos": [{"id": m.id, "tipo": m.tipo, "quantidade": float(m.quantidade), "observacao": m.observacao,
                             "ocorrencia_id": m.ocorrencia_id, "pedido_id": m.pedido_id,
                             "data_compra": datas_compra.get(m.pedido_id), "autor_nome": m.autor_nome,
                             "criado_em": m.criado_em} for m in movimentos]}


@app.get("/estoque")
def listar_estoque(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    itens = banco.query(ItemEstoque).filter(ItemEstoque.condominio_id == usuario.condominio_id).order_by(ItemEstoque.nome.asc()).all()
    return [_item_estoque_resposta(i, banco) for i in itens]


@app.post("/estoque", status_code=201)
def criar_item_estoque(dados: ItemEstoqueCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    item = ItemEstoque(condominio_id=usuario.condominio_id, nome=dados.nome.strip(), unidade=dados.unidade.strip(),
                       quantidade=dados.quantidade_inicial, estoque_minimo=dados.estoque_minimo, localizacao=dados.localizacao)
    banco.add(item); banco.flush()
    if dados.quantidade_inicial > 0:
        banco.add(MovimentoEstoque(item_id=item.id, tipo="entrada", quantidade=dados.quantidade_inicial,
                                  observacao="Saldo inicial.", pedido_id=dados.pedido_id, autor_id=usuario.id, autor_nome=usuario.nome))
    banco.commit(); banco.refresh(item)
    return _item_estoque_resposta(item, banco)


@app.post("/estoque/{item_id}/movimentos")
def movimentar_estoque(item_id: int, dados: MovimentoEstoqueCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    item = banco.query(ItemEstoque).filter(ItemEstoque.id == item_id, ItemEstoque.condominio_id == usuario.condominio_id).first()
    if not item: raise HTTPException(404, "Item não encontrado.")
    if dados.ocorrencia_id and not banco.query(Ocorrencia).filter(Ocorrencia.id == dados.ocorrencia_id, Ocorrencia.condominio_id == usuario.condominio_id).first():
        raise HTTPException(422, "Chamado inválido.")
    if dados.pedido_id and not banco.query(PedidoCompra).filter(PedidoCompra.id == dados.pedido_id, PedidoCompra.condominio_id == usuario.condominio_id).first():
        raise HTTPException(422, "Pedido inválido.")
    novo_saldo = float(item.quantidade) + (dados.quantidade if dados.tipo == "entrada" else -dados.quantidade)
    if novo_saldo < 0: raise HTTPException(422, "A saída é maior que o saldo disponível.")
    item.quantidade = novo_saldo
    banco.add(MovimentoEstoque(item_id=item.id, tipo=dados.tipo, quantidade=dados.quantidade, observacao=dados.observacao,
                              ocorrencia_id=dados.ocorrencia_id, pedido_id=dados.pedido_id, autor_id=usuario.id, autor_nome=usuario.nome))
    banco.commit(); banco.refresh(item)
    return _item_estoque_resposta(item, banco)


def _patrimonio_resposta(item: Patrimonio, banco: Session):
    foto = banco.query(FotoPatrimonio).filter(FotoPatrimonio.patrimonio_id == item.id).first()
    return {"id": item.id, "numero": item.numero, "nome": item.nome, "categoria": item.categoria,
            "localizacao": item.localizacao, "descricao": item.descricao,
            "valor_aquisicao": float(item.valor_aquisicao) if item.valor_aquisicao is not None else None,
            "data_aquisicao": item.data_aquisicao, "nota_fiscal": item.nota_fiscal, "estado": item.estado,
            "foto_data_url": item.foto_data_url, "foto_url": f"/api/patrimonios/{item.id}/foto/arquivo" if foto else None,
            "cadastrado_por_nome": item.cadastrado_por_nome,
            "criado_em": item.criado_em}


@app.get("/patrimonios")
def listar_patrimonios(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    itens = banco.query(Patrimonio).filter(Patrimonio.condominio_id == usuario.condominio_id).order_by(Patrimonio.id.desc()).all()
    return [_patrimonio_resposta(item, banco) for item in itens]


@app.post("/patrimonios", status_code=201)
def criar_patrimonio(dados: PatrimonioCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    item = Patrimonio(condominio_id=usuario.condominio_id, nome=dados.nome.strip(), categoria=dados.categoria.strip(),
                      localizacao=dados.localizacao.strip(), descricao=dados.descricao.strip() if dados.descricao else None,
                      valor_aquisicao=dados.valor_aquisicao, data_aquisicao=dados.data_aquisicao,
                      nota_fiscal=dados.nota_fiscal.strip() if dados.nota_fiscal else None, estado=dados.estado,
                      foto_data_url=dados.foto_data_url, cadastrado_por_id=usuario.id, cadastrado_por_nome=usuario.nome)
    banco.add(item); banco.flush()
    item.numero = f"PAT-{datetime.now(FUSO_BRASIL).year}-{item.id:05d}"
    banco.commit(); banco.refresh(item)
    return _patrimonio_resposta(item, banco)


def _validar_imagem(nome_original: str | None, mime_type: str | None, conteudo: bytes):
    if mime_type not in TIPOS_IMAGEM_ANEXO:
        raise HTTPException(422, "Envie somente imagens JPEG, PNG ou WebP.")
    if len(conteudo) > LIMITE_ANEXO_BYTES:
        raise HTTPException(413, "Cada imagem pode ter no máximo 8 MB.")
    return re.sub(r"[^A-Za-z0-9._ -]", "_", (nome_original or "imagem").rsplit("/", 1)[-1].rsplit("\\", 1)[-1])[:255]


@app.post("/patrimonios/{patrimonio_id}/foto", status_code=201)
async def enviar_foto_patrimonio(patrimonio_id: int, arquivo: UploadFile = File(...), banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    item = banco.query(Patrimonio).filter(Patrimonio.id == patrimonio_id, Patrimonio.condominio_id == usuario.condominio_id).first()
    if not item: raise HTTPException(404, "Patrimônio não encontrado.")
    conteudo = await arquivo.read(LIMITE_ANEXO_BYTES + 1); nome = _validar_imagem(arquivo.filename, arquivo.content_type, conteudo)
    storage = obter_storage(banco, usuario.condominio_id)
    anterior = banco.query(FotoPatrimonio).filter(FotoPatrimonio.patrimonio_id == item.id).first()
    salvo = storage.salvar(f"/CondoHub/Patrimonios/{item.numero}", nome, conteudo, arquivo.content_type)
    if anterior:
        storage.excluir(anterior.armazenamento_id, anterior.arquivo_externo_id); banco.delete(anterior)
    banco.add(FotoPatrimonio(patrimonio_id=item.id, provedor=salvo.provedor, arquivo_externo_id=salvo.arquivo_id,
                            armazenamento_id=salvo.armazenamento_id, nome=salvo.nome, mime_type=arquivo.content_type,
                            tamanho=salvo.tamanho, autor_id=usuario.id))
    item.foto_data_url = None; banco.commit()
    return _patrimonio_resposta(item, banco)


@app.get("/patrimonios/{patrimonio_id}/foto/arquivo")
def baixar_foto_patrimonio(patrimonio_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    item = banco.query(Patrimonio).filter(Patrimonio.id == patrimonio_id, Patrimonio.condominio_id == usuario.condominio_id).first()
    if not item: raise HTTPException(404, "Patrimônio não encontrado.")
    foto = banco.query(FotoPatrimonio).filter(FotoPatrimonio.patrimonio_id == item.id).first()
    if not foto: raise HTTPException(404, "Foto não encontrada.")
    arquivo = obter_storage(banco, usuario.condominio_id).baixar(foto.armazenamento_id, foto.arquivo_externo_id)
    return Response(content=arquivo.content, media_type=foto.mime_type, headers={"Cache-Control": "private, max-age=300"})


@app.post("/pedidos-compra/{pedido_id}/anexos", status_code=201)
async def enviar_anexos_pedido(pedido_id: int, arquivos: list[UploadFile] = File(...), banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    pedido = banco.query(PedidoCompra).filter(PedidoCompra.id == pedido_id, PedidoCompra.condominio_id == usuario.condominio_id).first()
    if not pedido: raise HTTPException(404, "Pedido não encontrado.")
    if not 1 <= len(arquivos) <= 5: raise HTTPException(422, "Envie de uma a cinco imagens por vez.")
    preparados = []
    for arquivo in arquivos:
        conteudo = await arquivo.read(LIMITE_ANEXO_BYTES + 1); nome = _validar_imagem(arquivo.filename, arquivo.content_type, conteudo)
        preparados.append((nome, arquivo.content_type, conteudo))
    storage = obter_storage(banco, usuario.condominio_id); salvos = []
    for nome, mime_type, conteudo in preparados:
        salvo = storage.salvar(f"/CondoHub/Compras/Pedido-{pedido.id}", nome, conteudo, mime_type)
        anexo = AnexoPedidoCompra(pedido_id=pedido.id, provedor=salvo.provedor, arquivo_externo_id=salvo.arquivo_id,
                                  armazenamento_id=salvo.armazenamento_id, nome=salvo.nome, mime_type=mime_type,
                                  tamanho=salvo.tamanho, autor_id=usuario.id)
        banco.add(anexo); banco.flush(); salvos.append(anexo)
    banco.commit()
    return [{"id": a.id, "nome": a.nome, "url": f"/api/pedidos-compra/{pedido.id}/anexos/{a.id}/arquivo"} for a in salvos]


@app.get("/pedidos-compra/{pedido_id}/anexos/{anexo_id}/arquivo")
def baixar_anexo_pedido(pedido_id: int, anexo_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    pedido = banco.query(PedidoCompra).filter(PedidoCompra.id == pedido_id, PedidoCompra.condominio_id == usuario.condominio_id).first()
    if not pedido: raise HTTPException(404, "Pedido não encontrado.")
    anexo = banco.query(AnexoPedidoCompra).filter(AnexoPedidoCompra.id == anexo_id, AnexoPedidoCompra.pedido_id == pedido.id).first()
    if not anexo: raise HTTPException(404, "Anexo não encontrado.")
    arquivo = obter_storage(banco, usuario.condominio_id).baixar(anexo.armazenamento_id, anexo.arquivo_externo_id)
    return Response(content=arquivo.content, media_type=anexo.mime_type, headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(anexo.nome)}", "Cache-Control": "private, max-age=300"})


def _prestador_resposta(prestador: PrestadorServico, banco: Session):
    atendimentos = banco.query(AtendimentoPrestador, Ocorrencia).join(Ocorrencia, Ocorrencia.id == AtendimentoPrestador.ocorrencia_id).filter(AtendimentoPrestador.prestador_id == prestador.id).order_by(AtendimentoPrestador.id.desc()).all()
    return {"id": prestador.id, "nome": prestador.nome, "especialidade": prestador.especialidade, "telefone": prestador.telefone,
            "email": prestador.email, "documento": prestador.documento, "observacoes": prestador.observacoes,
            "criado_em": prestador.criado_em,
            "atendimentos": [{"id": a.id, "ocorrencia_id": o.id, "ocorrencia_titulo": o.titulo,
                               "observacao": a.observacao, "criado_em": a.criado_em} for a, o in atendimentos]}


@app.get("/prestadores")
def listar_prestadores(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    itens = banco.query(PrestadorServico).filter(PrestadorServico.condominio_id == usuario.condominio_id).order_by(PrestadorServico.nome.asc()).all()
    return [_prestador_resposta(i, banco) for i in itens]


@app.post("/prestadores", status_code=201)
def criar_prestador(dados: PrestadorCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    prestador = PrestadorServico(condominio_id=usuario.condominio_id, **dados.model_dump())
    banco.add(prestador); banco.commit(); banco.refresh(prestador)
    return _prestador_resposta(prestador, banco)


def _cronograma_resposta(cronograma: Cronograma, banco: Session):
    etapas = (
        banco.query(EtapaCronograma)
        .filter(EtapaCronograma.cronograma_id == cronograma.id)
        .order_by(EtapaCronograma.ordem.asc())
        .all()
    )
    concluidas = sum(1 for etapa in etapas if etapa.status == "concluida")
    return {
        "id": cronograma.id,
        "titulo": cronograma.titulo,
        "categoria": cronograma.categoria,
        "objetivo": cronograma.objetivo,
        "responsavel": cronograma.responsavel,
        "inicio_previsto": cronograma.inicio_previsto,
        "fim_previsto": cronograma.fim_previsto,
        "prioridade": cronograma.prioridade,
        "orcamento_previsto": float(cronograma.orcamento_previsto) if cronograma.orcamento_previsto is not None else None,
        "status": cronograma.status,
        "publicado": cronograma.publicado,
        "ultima_atualizacao": cronograma.ultima_atualizacao,
        "atualizado_em": cronograma.atualizado_em,
        "progresso": round(concluidas * 100 / len(etapas)) if etapas else 0,
        "criado_por_nome": cronograma.criado_por_nome,
        "criado_em": cronograma.criado_em,
        "etapas": [
            {
                "id": etapa.id,
                "ordem": etapa.ordem,
                "titulo": etapa.titulo,
                "responsavel": etapa.responsavel,
                "inicio_previsto": etapa.inicio_previsto,
                "fim_previsto": etapa.fim_previsto,
                "custo_previsto": float(etapa.custo_previsto) if etapa.custo_previsto is not None else None,
                "status": etapa.status,
            }
            for etapa in etapas
        ],
    }


TIPOS_IMAGEM_ANEXO = {"image/jpeg", "image/png", "image/webp"}
LIMITE_ANEXO_BYTES = 8 * 1024 * 1024


def _buscar_ocorrencia(banco: Session, ocorrencia_id: int, condominio_id: int):
    ocorrencia = banco.query(Ocorrencia).filter(Ocorrencia.id == ocorrencia_id, Ocorrencia.condominio_id == condominio_id).first()
    if not ocorrencia:
        raise HTTPException(404, "Chamado não encontrado.")
    return ocorrencia


def _anexo_resposta(anexo: AnexoOcorrencia, usuario: ContextoCondominio):
    pode_gerenciar = not usuario.papeis.isdisjoint(PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS)
    return {"id": anexo.id, "nome": anexo.nome, "mime_type": anexo.mime_type, "tamanho": anexo.tamanho,
            "autor_nome": anexo.autor_nome, "criado_em": anexo.criado_em,
            "url": f"/api/ocorrencias/{anexo.ocorrencia_id}/anexos/{anexo.id}/arquivo",
            "pode_excluir": anexo.autor_id == usuario.id or pode_gerenciar}


@app.get("/ocorrencias/{ocorrencia_id}/anexos")
def listar_anexos_ocorrencia(ocorrencia_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    _buscar_ocorrencia(banco, ocorrencia_id, usuario.condominio_id)
    anexos = banco.query(AnexoOcorrencia).filter(AnexoOcorrencia.ocorrencia_id == ocorrencia_id).order_by(AnexoOcorrencia.criado_em.asc()).all()
    return [_anexo_resposta(anexo, usuario) for anexo in anexos]


@app.post("/ocorrencias/{ocorrencia_id}/anexos", status_code=201)
async def enviar_anexos_ocorrencia(ocorrencia_id: int, arquivos: list[UploadFile] = File(...), banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    _buscar_ocorrencia(banco, ocorrencia_id, usuario.condominio_id)
    if not 1 <= len(arquivos) <= 5:
        raise HTTPException(422, "Envie de uma a cinco imagens por vez.")
    preparados = []
    for arquivo in arquivos:
        if arquivo.content_type not in TIPOS_IMAGEM_ANEXO:
            raise HTTPException(422, "Envie somente imagens JPEG, PNG ou WebP.")
        conteudo = await arquivo.read(LIMITE_ANEXO_BYTES + 1)
        if len(conteudo) > LIMITE_ANEXO_BYTES:
            raise HTTPException(413, "Cada imagem pode ter no máximo 8 MB.")
        nome = re.sub(r"[^A-Za-z0-9._ -]", "_", (arquivo.filename or "imagem").rsplit("/", 1)[-1].rsplit("\\", 1)[-1])[:255]
        preparados.append((nome, arquivo.content_type, conteudo))
    storage = obter_storage(banco, usuario.condominio_id)
    salvos = []
    for nome, mime_type, conteudo in preparados:
        salvo = storage.salvar(f"/CondoHub/Anexos/Chamados/{ocorrencia_id}", nome, conteudo, mime_type)
        anexo = AnexoOcorrencia(ocorrencia_id=ocorrencia_id, provedor=salvo.provedor, arquivo_externo_id=salvo.arquivo_id,
                                armazenamento_id=salvo.armazenamento_id, nome=salvo.nome, mime_type=mime_type, tamanho=salvo.tamanho,
                                autor_id=usuario.id, autor_nome=usuario.nome)
        banco.add(anexo); banco.flush(); salvos.append(anexo)
    banco.commit()
    return [_anexo_resposta(anexo, usuario) for anexo in salvos]


@app.get("/ocorrencias/{ocorrencia_id}/anexos/{anexo_id}/arquivo")
def baixar_anexo_ocorrencia(ocorrencia_id: int, anexo_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    _buscar_ocorrencia(banco, ocorrencia_id, usuario.condominio_id)
    anexo = banco.query(AnexoOcorrencia).filter(AnexoOcorrencia.id == anexo_id, AnexoOcorrencia.ocorrencia_id == ocorrencia_id).first()
    if not anexo:
        raise HTTPException(404, "Anexo não encontrado.")
    arquivo = obter_storage(banco, usuario.condominio_id).baixar(anexo.armazenamento_id, anexo.arquivo_externo_id)
    return Response(content=arquivo.content, media_type=anexo.mime_type, headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(anexo.nome)}", "Cache-Control": "private, max-age=300"})


@app.delete("/ocorrencias/{ocorrencia_id}/anexos/{anexo_id}", status_code=204)
def excluir_anexo_ocorrencia(ocorrencia_id: int, anexo_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    _buscar_ocorrencia(banco, ocorrencia_id, usuario.condominio_id)
    anexo = banco.query(AnexoOcorrencia).filter(AnexoOcorrencia.id == anexo_id, AnexoOcorrencia.ocorrencia_id == ocorrencia_id).first()
    if not anexo:
        raise HTTPException(404, "Anexo não encontrado.")
    if anexo.autor_id != usuario.id and usuario.papeis.isdisjoint(PAPEIS_COM_IDENTIDADE_DOS_CHAMADOS):
        raise HTTPException(403, "Você não pode excluir este anexo.")
    obter_storage(banco, usuario.condominio_id).excluir(anexo.armazenamento_id, anexo.arquivo_externo_id)
    banco.delete(anexo); banco.commit()


@app.get("/cronogramas")
def listar_cronogramas(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    itens = (
        banco.query(Cronograma)
        .filter(Cronograma.condominio_id == usuario.condominio_id)
        .order_by(Cronograma.inicio_previsto.asc(), Cronograma.id.desc())
        .all()
    )
    return [_cronograma_resposta(item, banco) for item in itens]


@app.post("/cronogramas", status_code=201)
def criar_cronograma(dados: CronogramaCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    cronograma = Cronograma(
        condominio_id=usuario.condominio_id,
        titulo=dados.titulo.strip(),
        categoria=dados.categoria.strip(),
        objetivo=dados.objetivo.strip(),
        responsavel=dados.responsavel.strip(),
        inicio_previsto=dados.inicio_previsto,
        fim_previsto=dados.fim_previsto,
        prioridade=dados.prioridade,
        orcamento_previsto=dados.orcamento_previsto,
        status=dados.status,
        publicado=dados.status == "planejado",
        criado_por_id=usuario.id,
        criado_por_nome=usuario.nome,
    )
    banco.add(cronograma)
    banco.flush()
    for ordem, etapa in enumerate(dados.etapas, start=1):
        banco.add(EtapaCronograma(
            cronograma_id=cronograma.id,
            ordem=ordem,
            titulo=etapa.titulo.strip(),
            responsavel=etapa.responsavel.strip(),
            inicio_previsto=etapa.inicio_previsto,
            fim_previsto=etapa.fim_previsto,
            custo_previsto=etapa.custo_previsto,
            status="nao_iniciada",
        ))
    banco.commit()
    banco.refresh(cronograma)
    return _cronograma_resposta(cronograma, banco)


@app.put("/cronogramas/{cronograma_id}")
def editar_cronograma(cronograma_id: int, dados: CronogramaCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    cronograma = banco.query(Cronograma).filter(Cronograma.id == cronograma_id, Cronograma.condominio_id == usuario.condominio_id).first()
    if not cronograma:
        raise HTTPException(404, "Cronograma não encontrado.")
    cronograma.titulo = dados.titulo.strip(); cronograma.categoria = dados.categoria.strip()
    cronograma.objetivo = dados.objetivo.strip(); cronograma.responsavel = dados.responsavel.strip()
    cronograma.inicio_previsto = dados.inicio_previsto; cronograma.fim_previsto = dados.fim_previsto
    cronograma.prioridade = dados.prioridade; cronograma.orcamento_previsto = dados.orcamento_previsto
    cronograma.status = dados.status; cronograma.publicado = dados.status == "planejado"
    cronograma.atualizado_em = datetime.now(FUSO_BRASIL)
    existentes = banco.query(EtapaCronograma).filter(EtapaCronograma.cronograma_id == cronograma.id).order_by(EtapaCronograma.ordem.asc()).all()
    for indice, etapa_dados in enumerate(dados.etapas):
        if indice < len(existentes):
            etapa = existentes[indice]
        else:
            etapa = EtapaCronograma(cronograma_id=cronograma.id, status="nao_iniciada")
            banco.add(etapa)
        etapa.ordem = indice + 1; etapa.titulo = etapa_dados.titulo.strip(); etapa.responsavel = etapa_dados.responsavel.strip()
        etapa.inicio_previsto = etapa_dados.inicio_previsto; etapa.fim_previsto = etapa_dados.fim_previsto
        etapa.custo_previsto = etapa_dados.custo_previsto
    for etapa in existentes[len(dados.etapas):]:
        banco.delete(etapa)
    banco.commit(); banco.refresh(cronograma)
    return _cronograma_resposta(cronograma, banco)


def _modelo_cronograma_resposta(modelo: ModeloCronograma, banco: Session):
    etapas = banco.query(EtapaModeloCronograma).filter(EtapaModeloCronograma.modelo_id == modelo.id).order_by(EtapaModeloCronograma.ordem.asc()).all()
    return {
        "id": modelo.id, "nome": modelo.nome, "categoria": modelo.categoria,
        "objetivo": modelo.objetivo, "prioridade": modelo.prioridade,
        "criado_por_nome": modelo.criado_por_nome, "criado_em": modelo.criado_em,
        "duracao_total_dias": sum(etapa.duracao_dias for etapa in etapas),
        "etapas": [{"id": etapa.id, "ordem": etapa.ordem, "titulo": etapa.titulo,
                    "responsavel_sugerido": etapa.responsavel_sugerido,
                    "duracao_dias": etapa.duracao_dias} for etapa in etapas],
    }


@app.get("/cronogramas/modelos")
def listar_modelos_cronograma(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    modelos = banco.query(ModeloCronograma).filter(ModeloCronograma.condominio_id == usuario.condominio_id).order_by(ModeloCronograma.nome.asc()).all()
    return [_modelo_cronograma_resposta(modelo, banco) for modelo in modelos]


@app.post("/cronogramas/modelos", status_code=201)
def criar_modelo_cronograma(dados: ModeloCronogramaCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    modelo = ModeloCronograma(condominio_id=usuario.condominio_id, nome=dados.nome.strip(), categoria=dados.categoria.strip(),
                              objetivo=dados.objetivo.strip(), prioridade=dados.prioridade,
                              criado_por_id=usuario.id, criado_por_nome=usuario.nome)
    banco.add(modelo)
    try:
        banco.flush()
        for ordem, etapa in enumerate(dados.etapas, start=1):
            banco.add(EtapaModeloCronograma(modelo_id=modelo.id, ordem=ordem, titulo=etapa.titulo.strip(),
                                            responsavel_sugerido=etapa.responsavel_sugerido.strip() if etapa.responsavel_sugerido else None,
                                            duracao_dias=etapa.duracao_dias))
        banco.commit()
    except IntegrityError:
        banco.rollback()
        raise HTTPException(409, "Já existe um modelo com este nome.")
    banco.refresh(modelo)
    return _modelo_cronograma_resposta(modelo, banco)


@app.put("/cronogramas/modelos/{modelo_id}")
def editar_modelo_cronograma(modelo_id: int, dados: ModeloCronogramaCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    modelo = banco.query(ModeloCronograma).filter(ModeloCronograma.id == modelo_id, ModeloCronograma.condominio_id == usuario.condominio_id).first()
    if not modelo:
        raise HTTPException(404, "Modelo não encontrado.")
    modelo.nome = dados.nome.strip(); modelo.categoria = dados.categoria.strip()
    modelo.objetivo = dados.objetivo.strip(); modelo.prioridade = dados.prioridade
    banco.query(EtapaModeloCronograma).filter(EtapaModeloCronograma.modelo_id == modelo.id).delete(synchronize_session=False)
    for ordem, etapa in enumerate(dados.etapas, start=1):
        banco.add(EtapaModeloCronograma(modelo_id=modelo.id, ordem=ordem, titulo=etapa.titulo.strip(),
                                        responsavel_sugerido=etapa.responsavel_sugerido.strip() if etapa.responsavel_sugerido else None,
                                        duracao_dias=etapa.duracao_dias))
    try:
        banco.commit()
    except IntegrityError:
        banco.rollback()
        raise HTTPException(409, "Já existe um modelo com este nome.")
    banco.refresh(modelo)
    return _modelo_cronograma_resposta(modelo, banco)


@app.delete("/cronogramas/modelos/{modelo_id}", status_code=204)
def excluir_modelo_cronograma(modelo_id: int, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    modelo = banco.query(ModeloCronograma).filter(ModeloCronograma.id == modelo_id, ModeloCronograma.condominio_id == usuario.condominio_id).first()
    if not modelo:
        raise HTTPException(404, "Modelo não encontrado.")
    banco.delete(modelo); banco.commit()


@app.patch("/cronogramas/{cronograma_id}/publicacao")
def alterar_publicacao_cronograma(cronograma_id: int, dados: CronogramaPublicacao, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    cronograma = banco.query(Cronograma).filter(Cronograma.id == cronograma_id, Cronograma.condominio_id == usuario.condominio_id).first()
    if not cronograma:
        raise HTTPException(404, "Cronograma não encontrado.")
    if dados.publicado and cronograma.status != "planejado":
        raise HTTPException(422, "Conclua o planejamento antes de publicar.")
    cronograma.publicado = dados.publicado
    if dados.atualizacao is not None:
        cronograma.ultima_atualizacao = dados.atualizacao.strip() or None
    cronograma.atualizado_em = datetime.now(FUSO_BRASIL)
    banco.commit()
    banco.refresh(cronograma)
    return _cronograma_resposta(cronograma, banco)


@app.patch("/cronogramas/{cronograma_id}/etapas/{etapa_id}")
def alterar_status_etapa(cronograma_id: int, etapa_id: int, dados: EtapaCronogramaStatus, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_gestor)):
    cronograma = banco.query(Cronograma).filter(Cronograma.id == cronograma_id, Cronograma.condominio_id == usuario.condominio_id).first()
    if not cronograma:
        raise HTTPException(404, "Cronograma não encontrado.")
    etapa = banco.query(EtapaCronograma).filter(EtapaCronograma.id == etapa_id, EtapaCronograma.cronograma_id == cronograma.id).first()
    if not etapa:
        raise HTTPException(404, "Etapa não encontrada.")
    etapa.status = dados.status
    if dados.atualizacao is not None:
        cronograma.ultima_atualizacao = dados.atualizacao.strip() or None
    cronograma.atualizado_em = datetime.now(FUSO_BRASIL)
    banco.commit()
    banco.refresh(cronograma)
    return _cronograma_resposta(cronograma, banco)


@app.get("/acompanhamento")
def listar_acompanhamento(banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(contexto_condominio)):
    cronogramas = (
        banco.query(Cronograma)
        .filter(Cronograma.condominio_id == usuario.condominio_id, Cronograma.status == "planejado")
        .order_by(Cronograma.fim_previsto.asc(), Cronograma.id.desc())
        .all()
    )
    respostas = []
    for cronograma in cronogramas:
        completo = _cronograma_resposta(cronograma, banco)
        respostas.append({
            "id": completo["id"], "titulo": completo["titulo"], "categoria": completo["categoria"],
            "objetivo": completo["objetivo"], "inicio_previsto": completo["inicio_previsto"],
            "fim_previsto": completo["fim_previsto"], "ultima_atualizacao": completo["ultima_atualizacao"],
            "atualizado_em": completo["atualizado_em"], "progresso": completo["progresso"],
            "etapas": [{"id": etapa["id"], "ordem": etapa["ordem"], "titulo": etapa["titulo"],
                        "inicio_previsto": etapa["inicio_previsto"], "fim_previsto": etapa["fim_previsto"],
                        "status": etapa["status"]} for etapa in completo["etapas"]],
        })
    return respostas


@app.post("/prestadores/{prestador_id}/atendimentos", status_code=201)
def vincular_atendimento(prestador_id: int, dados: AtendimentoPrestadorCriar, banco: Session = Depends(pegar_banco), usuario: ContextoCondominio = Depends(exigir_aprovador)):
    prestador = banco.query(PrestadorServico).filter(PrestadorServico.id == prestador_id, PrestadorServico.condominio_id == usuario.condominio_id).first()
    ocorrencia = banco.query(Ocorrencia).filter(Ocorrencia.id == dados.ocorrencia_id, Ocorrencia.condominio_id == usuario.condominio_id).first()
    if not prestador or not ocorrencia: raise HTTPException(404, "Prestador ou chamado não encontrado.")
    banco.add(AtendimentoPrestador(prestador_id=prestador.id, ocorrencia_id=ocorrencia.id, observacao=dados.observacao))
    try: banco.commit()
    except IntegrityError:
        banco.rollback(); raise HTTPException(409, "Este prestador já está vinculado ao chamado.")
    return _prestador_resposta(prestador, banco)


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
    modulos = banco.query(ModuloCondominio).filter(ModuloCondominio.condominio_id == usuario.condominio_id).all()
    return {
        "id": usuario.id,
        "papeis": sorted(usuario.papeis),
        "admin_plataforma": admin_plataforma,
        "modulos": {
            modulo.chave: {
                "habilitado": modulo.habilitado,
                "visivel_moradores": modulo.visivel_moradores,
            }
            for modulo in modulos
        },
        "condominio": {
            "id": usuario.condominio_id,
            "slug": usuario.condominio_slug,
            "nome": usuario.condominio_nome,
        },
    }


@app.delete("/me/dados", status_code=204)
def excluir_meus_dados(
    banco: Session = Depends(pegar_banco),
    usuario: UsuarioAutenticado = Depends(usuario_atual),
):
    """Remove dados pessoais antes da exclusão definitiva no provedor de login."""
    perfil = buscar_perfil_clerk(usuario.id)
    identificador_anonimo = "usuario_excluido"
    nome_anonimo = "Usuário excluído"

    banco.query(ReacaoMensagem).filter(
        ReacaoMensagem.usuario_id == usuario.id
    ).delete(synchronize_session=False)
    banco.query(NotificacaoOcorrencia).filter(
        NotificacaoOcorrencia.destinatario_id == usuario.id
    ).delete(synchronize_session=False)
    banco.query(NotificacaoOcorrencia).filter(
        NotificacaoOcorrencia.ator_id == usuario.id
    ).update(
        {NotificacaoOcorrencia.ator_id: identificador_anonimo},
        synchronize_session=False,
    )
    banco.query(ReservaAmbiente).filter(
        ReservaAmbiente.morador_id == usuario.id
    ).delete(synchronize_session=False)
    banco.query(MembroCondominio).filter(
        MembroCondominio.clerk_user_id == usuario.id
    ).delete(synchronize_session=False)
    banco.query(AdministradorPlataforma).filter(
        AdministradorPlataforma.clerk_user_id == usuario.id
    ).delete(synchronize_session=False)

    if perfil.email:
        banco.query(SolicitacaoAcesso).filter(
            SolicitacaoAcesso.email == perfil.email
        ).delete(synchronize_session=False)

    banco.query(SolicitacaoAcesso).filter(
        SolicitacaoAcesso.decidido_por == usuario.id
    ).update(
        {SolicitacaoAcesso.decidido_por: None},
        synchronize_session=False,
    )
    banco.query(Ocorrencia).filter(Ocorrencia.autor_id == usuario.id).update(
        {
            Ocorrencia.autor_id: None,
            Ocorrencia.autor_nome: nome_anonimo,
            Ocorrencia.autor_avatar_url: None,
        },
        synchronize_session=False,
    )
    banco.query(MensagemOcorrencia).filter(
        MensagemOcorrencia.autor_id == usuario.id
    ).update(
        {
            MensagemOcorrencia.autor_id: identificador_anonimo,
            MensagemOcorrencia.autor_nome: nome_anonimo,
            MensagemOcorrencia.autor_avatar_url: None,
            MensagemOcorrencia.autor_papeis: "",
        },
        synchronize_session=False,
    )
    banco.query(PedidoCompra).filter(
        PedidoCompra.solicitante_id == usuario.id
    ).update(
        {
            PedidoCompra.solicitante_id: identificador_anonimo,
            PedidoCompra.solicitante_nome: nome_anonimo,
        },
        synchronize_session=False,
    )
    banco.query(HistoricoPedidoCompra).filter(
        HistoricoPedidoCompra.autor_id == usuario.id
    ).update(
        {
            HistoricoPedidoCompra.autor_id: identificador_anonimo,
            HistoricoPedidoCompra.autor_nome: nome_anonimo,
        },
        synchronize_session=False,
    )
    banco.query(MovimentoEstoque).filter(
        MovimentoEstoque.autor_id == usuario.id
    ).update(
        {
            MovimentoEstoque.autor_id: identificador_anonimo,
            MovimentoEstoque.autor_nome: nome_anonimo,
        },
        synchronize_session=False,
    )
    banco.query(AnexoOcorrencia).filter(AnexoOcorrencia.autor_id == usuario.id).update(
        {AnexoOcorrencia.autor_id: identificador_anonimo, AnexoOcorrencia.autor_nome: nome_anonimo},
        synchronize_session=False,
    )
    banco.commit()
    return None


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


@app.get("/referencias")
def listar_referencias(
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    pessoas = banco.query(MembroCondominio).filter(
        MembroCondominio.condominio_id == usuario.condominio_id,
        MembroCondominio.status == "ativo",
    ).order_by(MembroCondominio.nome.asc()).all()
    chamados = banco.query(Ocorrencia).filter(
        Ocorrencia.condominio_id == usuario.condominio_id,
    ).order_by(Ocorrencia.id.desc()).all()
    pedidos = banco.query(PedidoCompra).filter(
        PedidoCompra.condominio_id == usuario.condominio_id,
    ).order_by(PedidoCompra.id.desc()).all()
    return {
        "pessoas": [{"id": p.id, "nome": p.nome, "avatar_url": p.avatar_url} for p in pessoas],
        "chamados": [{"id": c.id, "nome": c.titulo} for c in chamados],
        "pedidos": [{"id": p.id, "nome": p.item} for p in pedidos],
    }


@app.get("/pessoas/{membro_id}")
def obter_pessoa(
    membro_id: int,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(contexto_condominio),
):
    membro = banco.query(MembroCondominio).filter(
        MembroCondominio.id == membro_id,
        MembroCondominio.condominio_id == usuario.condominio_id,
        MembroCondominio.status == "ativo",
    ).first()
    if not membro:
        raise HTTPException(404, "Pessoa não encontrada.")
    return {
        "id": membro.id, "nome": membro.nome, "avatar_url": membro.avatar_url,
        "papeis": sorted(p for p in membro.papeis.split(",") if p),
        "bloco": membro.bloco, "apartamento": membro.apartamento,
    }


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
    configuracoes = banco.query(ModuloCondominio).all()
    por_condominio = {}
    for modulo in configuracoes:
        por_condominio.setdefault(modulo.condominio_id, {})[modulo.chave] = {
            "habilitado": modulo.habilitado,
            "visivel_moradores": modulo.visivel_moradores,
        }
    return [
        {
            "id": item.id,
            "nome": item.nome,
            "slug": item.slug,
            "ativo": item.ativo == 1,
            "modulos": por_condominio.get(item.id, {}),
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
    for chave, _nome, _moradores in CATALOGO_MODULOS:
        banco.add(ModuloCondominio(condominio_id=condominio.id, chave=chave, habilitado=False, visivel_moradores=False))
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


@app.patch("/admin/condominios/{condominio_id}/modulos/{chave}")
def configurar_modulo_pela_plataforma(
    condominio_id: int,
    chave: str,
    dados: ModuloHabilitacao,
    banco: Session = Depends(pegar_banco),
    _usuario: UsuarioAutenticado = Depends(exigir_admin_plataforma),
):
    if chave not in {item[0] for item in CATALOGO_MODULOS}:
        raise HTTPException(404, "Módulo não encontrado.")
    modulo = banco.query(ModuloCondominio).filter(ModuloCondominio.condominio_id == condominio_id, ModuloCondominio.chave == chave).first()
    if not modulo:
        modulo = ModuloCondominio(condominio_id=condominio_id, chave=chave)
        banco.add(modulo)
    modulo.habilitado = dados.habilitado
    if not dados.habilitado:
        modulo.visivel_moradores = False
    banco.commit()
    return {"chave": chave, "habilitado": modulo.habilitado, "visivel_moradores": modulo.visivel_moradores}


@app.get("/configuracoes/modulos")
def listar_configuracoes_modulos(
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    modulos = {item.chave: item for item in banco.query(ModuloCondominio).filter(ModuloCondominio.condominio_id == usuario.condominio_id).all()}
    return [
        {"chave": chave, "nome": nome, "permite_moradores": permite_moradores,
         "habilitado": bool(modulos.get(chave) and modulos[chave].habilitado),
         "visivel_moradores": bool(modulos.get(chave) and modulos[chave].visivel_moradores)}
        for chave, nome, permite_moradores in CATALOGO_MODULOS
    ]


@app.patch("/configuracoes/modulos/{chave}/visibilidade")
def configurar_visibilidade_moradores(
    chave: str,
    dados: ModuloVisibilidade,
    banco: Session = Depends(pegar_banco),
    usuario: ContextoCondominio = Depends(exigir_aprovador),
):
    catalogo = {item[0]: item for item in CATALOGO_MODULOS}
    if chave not in catalogo or not catalogo[chave][2]:
        raise HTTPException(422, "Este módulo não possui visualização para moradores.")
    modulo = banco.query(ModuloCondominio).filter(ModuloCondominio.condominio_id == usuario.condominio_id, ModuloCondominio.chave == chave).first()
    if not modulo or not modulo.habilitado:
        raise HTTPException(422, "O módulo precisa ser liberado pelo CondoHub primeiro.")
    modulo.visivel_moradores = dados.visivel_moradores
    banco.commit()
    return {"chave": chave, "habilitado": modulo.habilitado, "visivel_moradores": modulo.visivel_moradores}


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
    "/solicitacoes-acesso/{solicitacao_id}/atualizar-convite",
    response_model=SolicitacaoAcessoResposta,
)
def atualizar_convite_solicitacao(
    solicitacao_id: int,
    dados: SolicitacaoAtualizarConvite,
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
    if solicitacao.status != "aprovada" or not solicitacao.clerk_invitation_id:
        raise HTTPException(
            status_code=409,
            detail="Esta solicitação não possui um convite para reenviar.",
        )

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
