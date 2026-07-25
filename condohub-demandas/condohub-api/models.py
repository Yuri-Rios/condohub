from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from database import Base

FUSO_BRASIL = ZoneInfo("America/Fortaleza")


def agora_no_brasil():
    return datetime.now(FUSO_BRASIL)

class Ocorrencia(Base):
    __tablename__ = "ocorrencias"
    id = Column(Integer, primary_key=True, index=True)
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


class SolicitacaoAcesso(Base):
    __tablename__ = "solicitacoes_acesso"

    id = Column(Integer, primary_key=True, index=True)
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
