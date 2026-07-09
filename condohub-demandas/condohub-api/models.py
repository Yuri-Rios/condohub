from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from database import Base
from datetime import datetime

class Ocorrencia(Base):
    __tablename__ = "ocorrencias"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String)
    local = Column(String)
    descricao = Column(String)
    data_solicitacao = Column(DateTime, default=datetime.now)