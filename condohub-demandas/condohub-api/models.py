from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint

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
