from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint

from database import Base

FUSO_BRASIL = ZoneInfo("America/Fortaleza")


def agora_no_brasil():
    return datetime.now(FUSO_BRASIL)


class Condominio(Base):
    __tablename__ = "condominios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(160), nullable=False)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    ativo = Column(Integer, nullable=False, default=1)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class MembroCondominio(Base):
    __tablename__ = "membros_condominio"
    __table_args__ = (
        UniqueConstraint(
            "condominio_id",
            "clerk_user_id",
            name="uq_membro_condominio_usuario",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(
        Integer,
        ForeignKey("condominios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    clerk_user_id = Column(String(255), nullable=False, index=True)
    nome = Column(String(160), nullable=False)
    avatar_url = Column(Text, nullable=True)
    papeis = Column(String(255), nullable=False)
    bloco = Column(String(40), nullable=True)
    apartamento = Column(String(40), nullable=True)
    status = Column(String(20), nullable=False, default="ativo", index=True)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class AdministradorPlataforma(Base):
    __tablename__ = "administradores_plataforma"

    id = Column(Integer, primary_key=True, index=True)
    clerk_user_id = Column(String(255), nullable=False, unique=True, index=True)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class Ocorrencia(Base):
    __tablename__ = "ocorrencias"
    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(
        Integer,
        ForeignKey("condominios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    titulo = Column(String)
    local = Column(String)
    descricao = Column(String)
    status = Column(String(30), nullable=False, default="novo", index=True)
    autor_id = Column(String(255), nullable=True, index=True)
    autor_nome = Column(String(160), nullable=True)
    autor_avatar_url = Column(Text, nullable=True)
    data_solicitacao = Column(
        DateTime(timezone=True),
        default=agora_no_brasil,
        nullable=False,
    )


class MensagemOcorrencia(Base):
    __tablename__ = "mensagens_ocorrencia"

    id = Column(Integer, primary_key=True, index=True)
    ocorrencia_id = Column(
        Integer,
        ForeignKey("ocorrencias.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conteudo = Column(Text, nullable=False)
    autor_id = Column(String(255), nullable=False, index=True)
    autor_nome = Column(String(160), nullable=False)
    autor_avatar_url = Column(Text, nullable=True)
    autor_papeis = Column(String(255), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class NotificacaoOcorrencia(Base):
    __tablename__ = "notificacoes_ocorrencia"

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(
        Integer,
        ForeignKey("condominios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ocorrencia_id = Column(
        Integer,
        ForeignKey("ocorrencias.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    destinatario_id = Column(String(255), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)
    ator_id = Column(String(255), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)
    lida_em = Column(DateTime(timezone=True), nullable=True, index=True)


class ReacaoMensagem(Base):
    __tablename__ = "reacoes_mensagem"
    __table_args__ = (
        UniqueConstraint(
            "mensagem_id",
            "usuario_id",
            "emoji",
            name="uq_reacao_mensagem_usuario_emoji",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    mensagem_id = Column(
        Integer,
        ForeignKey("mensagens_ocorrencia.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    usuario_id = Column(String(255), nullable=False, index=True)
    emoji = Column(String(10), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class PedidoCompra(Base):
    __tablename__ = "pedidos_compra"
    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False, index=True)
    ocorrencia_id = Column(Integer, ForeignKey("ocorrencias.id", ondelete="SET NULL"), nullable=True, index=True)
    item = Column(String(160), nullable=False)
    quantidade = Column(Numeric(12, 3), nullable=False)
    unidade = Column(String(30), nullable=False)
    justificativa = Column(Text, nullable=False)
    valor_estimado = Column(Numeric(12, 2), nullable=True)
    status = Column(String(30), nullable=False, default="create", index=True)
    solicitante_id = Column(String(255), nullable=False, index=True)
    solicitante_nome = Column(String(160), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)
    atualizado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class HistoricoPedidoCompra(Base):
    __tablename__ = "historico_pedidos_compra"
    id = Column(Integer, primary_key=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_compra.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(30), nullable=False)
    observacao = Column(Text, nullable=True)
    autor_id = Column(String(255), nullable=False)
    autor_nome = Column(String(160), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class ItemEstoque(Base):
    __tablename__ = "itens_estoque"
    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(160), nullable=False)
    unidade = Column(String(30), nullable=False)
    quantidade = Column(Numeric(12, 3), nullable=False, default=0)
    estoque_minimo = Column(Numeric(12, 3), nullable=True)
    localizacao = Column(String(160), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class MovimentoEstoque(Base):
    __tablename__ = "movimentos_estoque"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("itens_estoque.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    quantidade = Column(Numeric(12, 3), nullable=False)
    observacao = Column(Text, nullable=True)
    ocorrencia_id = Column(Integer, ForeignKey("ocorrencias.id", ondelete="SET NULL"), nullable=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_compra.id", ondelete="SET NULL"), nullable=True)
    autor_id = Column(String(255), nullable=False)
    autor_nome = Column(String(160), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class PrestadorServico(Base):
    __tablename__ = "prestadores_servico"
    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(160), nullable=False)
    especialidade = Column(String(160), nullable=False)
    telefone = Column(String(60), nullable=True)
    email = Column(String(320), nullable=True)
    documento = Column(String(60), nullable=True)
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class AtendimentoPrestador(Base):
    __tablename__ = "atendimentos_prestador"
    __table_args__ = (
        UniqueConstraint(
            "prestador_id",
            "ocorrencia_id",
            name="uq_atendimento_prestador_ocorrencia",
        ),
    )
    id = Column(Integer, primary_key=True)
    prestador_id = Column(Integer, ForeignKey("prestadores_servico.id", ondelete="CASCADE"), nullable=False, index=True)
    ocorrencia_id = Column(Integer, ForeignKey("ocorrencias.id", ondelete="CASCADE"), nullable=False, index=True)
    observacao = Column(Text, nullable=True)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class Cronograma(Base):
    __tablename__ = "cronogramas"

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False, index=True)
    titulo = Column(String(160), nullable=False)
    categoria = Column(String(60), nullable=False)
    objetivo = Column(Text, nullable=False)
    responsavel = Column(String(160), nullable=False)
    inicio_previsto = Column(Date, nullable=False)
    fim_previsto = Column(Date, nullable=False)
    prioridade = Column(String(20), nullable=False, default="normal")
    orcamento_previsto = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), nullable=False, default="rascunho", index=True)
    publicado = Column(Boolean, nullable=False, default=False, index=True)
    ultima_atualizacao = Column(Text, nullable=True)
    atualizado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)
    criado_por_id = Column(String(255), nullable=False)
    criado_por_nome = Column(String(160), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class EtapaCronograma(Base):
    __tablename__ = "etapas_cronograma"

    id = Column(Integer, primary_key=True, index=True)
    cronograma_id = Column(Integer, ForeignKey("cronogramas.id", ondelete="CASCADE"), nullable=False, index=True)
    ordem = Column(Integer, nullable=False)
    titulo = Column(String(160), nullable=False)
    responsavel = Column(String(160), nullable=False)
    inicio_previsto = Column(Date, nullable=False)
    fim_previsto = Column(Date, nullable=False)
    custo_previsto = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), nullable=False, default="planejada")


class ReservaAmbiente(Base):
    __tablename__ = "reservas_ambientes"
    __table_args__ = (
        UniqueConstraint(
            "condominio_id",
            "ambiente",
            "inicio",
            name="uq_reserva_condominio_ambiente_inicio",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(
        Integer,
        ForeignKey("condominios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ambiente = Column(String(30), nullable=False, index=True)
    inicio = Column(DateTime(timezone=True), nullable=False, index=True)
    fim = Column(DateTime(timezone=True), nullable=False)
    morador_id = Column(String(255), nullable=False, index=True)
    morador_nome = Column(String(160), nullable=False)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)


class SolicitacaoAcesso(Base):
    __tablename__ = "solicitacoes_acesso"

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(
        Integer,
        ForeignKey("condominios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nome = Column(String(160), nullable=False)
    email = Column(String(320), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    bloco = Column(String(40), nullable=True)
    apartamento = Column(String(40), nullable=True)
    observacao = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pendente", index=True)
    criado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)
    decidido_em = Column(DateTime(timezone=True), nullable=True)
    decidido_por = Column(String(255), nullable=True)
    motivo_recusa = Column(Text, nullable=True)
    clerk_invitation_id = Column(String(255), nullable=True)


class IntegracaoOneDrive(Base):
    __tablename__ = "integracoes_onedrive"
    __table_args__ = (
        UniqueConstraint("condominio_id", name="uq_integracao_onedrive_condominio"),
    )

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False, index=True)
    microsoft_account_id = Column(String(255), nullable=False)
    microsoft_email = Column(String(320), nullable=True)
    drive_id = Column(String(255), nullable=False)
    root_item_id = Column(String(255), nullable=False)
    root_path = Column(Text, nullable=False)
    refresh_token_criptografado = Column(Text, nullable=False)
    escopos = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="ativa")
    conectado_por = Column(String(255), nullable=False)
    conectado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)
    ultima_sincronizacao_em = Column(DateTime(timezone=True), nullable=True)
    erro_ultima_sincronizacao = Column(Text, nullable=True)


class Ata(Base):
    __tablename__ = "atas"
    __table_args__ = (
        UniqueConstraint("condominio_id", "drive_id", "drive_item_id", name="uq_ata_item_onedrive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    tipo = Column(String(40), nullable=False, default="assembleia")
    data_assembleia = Column(DateTime(timezone=True), nullable=True)
    descricao = Column(Text, nullable=True)
    drive_id = Column(String(255), nullable=False)
    drive_item_id = Column(String(255), nullable=False)
    nome_arquivo = Column(String(255), nullable=False)
    mime_type = Column(String(160), nullable=True)
    tamanho = Column(Integer, nullable=True)
    etag = Column(Text, nullable=True)
    modificado_em = Column(DateTime(timezone=True), nullable=True)
    publicada = Column(Boolean, nullable=False, default=False, index=True)
    publicado_em = Column(DateTime(timezone=True), nullable=True)
    publicado_por = Column(String(255), nullable=True)
    importado_em = Column(DateTime(timezone=True), default=agora_no_brasil, nullable=False)
