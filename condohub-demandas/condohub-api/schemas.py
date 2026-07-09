from datetime import datetime
from pydantic import BaseModel


class OcorrenciaCriar(BaseModel):
    titulo: str
    local: str
    descricao: str


class OcorrenciaResposta(BaseModel):
    id: int
    titulo: str
    local: str
    descricao: str
    data_solicitacao: datetime

    class Config:
        from_attributes = True