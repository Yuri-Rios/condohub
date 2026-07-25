from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator, model_validator


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


class SolicitacaoAcessoCriar(BaseModel):
    nome: str
    email: EmailStr
    tipo: str
    bloco: str | None = None
    apartamento: str | None = None
    observacao: str | None = None

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str):
        valor = valor.strip()
        if len(valor) < 3:
            raise ValueError("Informe o nome completo.")
        return valor

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, valor: str):
        if valor not in {"morador", "funcionario"}:
            raise ValueError("Tipo de acesso inválido.")
        return valor

    @field_validator("apartamento")
    @classmethod
    def validar_apartamento(cls, valor: str | None):
        if valor is not None and not valor.strip().isdigit():
            raise ValueError("Informe o apartamento usando apenas números.")
        return valor.strip() if valor else None

    @model_validator(mode="after")
    def validar_unidade(self):
        if self.tipo == "morador" and (not self.bloco or not self.apartamento):
            raise ValueError("Bloco e apartamento são obrigatórios para morador.")
        return self


class SolicitacaoAcessoResposta(SolicitacaoAcessoCriar):
    id: int
    status: str
    criado_em: datetime
    decidido_em: datetime | None = None
    decidido_por: str | None = None
    motivo_recusa: str | None = None
    clerk_invitation_id: str | None = None

    class Config:
        from_attributes = True


class SolicitacaoRecusar(BaseModel):
    motivo: str


class SolicitacaoConfirmarConvite(BaseModel):
    invitation_id: str
