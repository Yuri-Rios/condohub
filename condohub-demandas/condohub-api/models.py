from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Column, DateTime, Integer, String, Text

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
    data_solicitacao = Column(
        DateTime(timezone=True),
        default=agora_no_brasil,
        nullable=False,
    )


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
