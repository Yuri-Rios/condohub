from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from database import Base


class Ocorrencia(Base):
    __tablename__ = "ocorrencias"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    local = Column(String, nullable=False)
    descricao = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())