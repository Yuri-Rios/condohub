from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Column, DateTime, Integer, String

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
