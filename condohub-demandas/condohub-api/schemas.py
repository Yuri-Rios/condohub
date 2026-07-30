from datetime import datetime
from zoneinfo import ZoneInfo
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class CondominioCriar(BaseModel):
    nome: str
    slug: str

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str):
        valor = valor.strip()
        if len(valor) < 3:
            raise ValueError("Informe o nome do condomínio.")
        return valor

    @field_validator("slug")
    @classmethod
    def validar_slug(cls, valor: str):
        import re

        valor = valor.strip().lower()
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", valor):
            raise ValueError("Use letras minúsculas, números e hífens no endereço.")
        return valor


class OcorrenciaCriar(BaseModel):
    titulo: str
    local: str
    descricao: str

    @field_validator("titulo")
    @classmethod
    def validar_titulo(cls, valor: str):
        valor = valor.strip()
        if len(valor) < 3:
            raise ValueError("Informe um título com pelo menos 3 caracteres.")
        if len(valor) > 160:
            raise ValueError("O título deve ter no máximo 160 caracteres.")
        return valor

    @field_validator("local")
    @classmethod
    def validar_local(cls, valor: str):
        valor = valor.strip()
        if len(valor) < 2:
            raise ValueError("Informe o local do chamado.")
        if len(valor) > 160:
            raise ValueError("O local deve ter no máximo 160 caracteres.")
        return valor

    @field_validator("descricao")
    @classmethod
    def validar_descricao(cls, valor: str):
        valor = valor.strip()
        if len(valor) < 3:
            raise ValueError("Descreva o chamado.")
        if len(valor) > 4000:
            raise ValueError("A descrição deve ter no máximo 4.000 caracteres.")
        return valor


class OcorrenciaResposta(BaseModel):
    id: int
    titulo: str
    local: str
    descricao: str
    status: str
    data_solicitacao: datetime
    autor_nome: str | None = None
    pode_editar: bool = False

    class Config:
        from_attributes = True


class MensagemCriar(BaseModel):
    conteudo: str

    @field_validator("conteudo")
    @classmethod
    def validar_conteudo(cls, valor: str):
        valor = valor.strip()
        if not valor:
            raise ValueError("A mensagem não pode ficar vazia.")
        if len(valor) > 4000:
            raise ValueError("A mensagem deve ter no máximo 4.000 caracteres.")
        return valor


class ReacaoResposta(BaseModel):
    emoji: str
    quantidade: int
    minha: bool


class MensagemResposta(BaseModel):
    id: int
    ocorrencia_id: int
    conteudo: str
    autor_id: str
    autor_nome: str
    autor_avatar_url: str | None = None
    autor_papeis: list[str]
    criado_em: datetime
    reacoes: list[ReacaoResposta] = Field(default_factory=list)


class ReacaoAlternar(BaseModel):
    emoji: str

    @field_validator("emoji")
    @classmethod
    def validar_emoji(cls, valor: str):
        if valor not in {"👍", "❤️", "😂", "👏"}:
            raise ValueError("Reação inválida.")
        return valor


class OcorrenciaDetalhe(OcorrenciaResposta):
    autor_avatar_url: str | None = None
    pode_alterar_status: bool
    pode_reabrir: bool
    mensagens: list[MensagemResposta]


class StatusOcorrenciaAlterar(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validar_status(cls, valor: str):
        if valor not in {"novo", "em_andamento", "em_espera", "fechado"}:
            raise ValueError("Status inválido.")
        return valor


class ReservaCriar(BaseModel):
    ambiente: str
    inicio: datetime

    @field_validator("ambiente")
    @classmethod
    def validar_ambiente(cls, valor: str):
        if valor not in {"piscina_deck", "salao_festas"}:
            raise ValueError("Ambiente inválido.")
        return valor

    @field_validator("inicio")
    @classmethod
    def validar_inicio(cls, valor: datetime):
        if valor.tzinfo is None:
            raise ValueError("O horário precisa informar o fuso.")
        horario_local = valor.astimezone(ZoneInfo("America/Fortaleza"))
        if horario_local.minute != 0 or horario_local.hour not in range(8, 22, 2):
            raise ValueError("Selecione um dos horários disponíveis.")
        return valor


class ReservaResposta(BaseModel):
    id: int | None
    ambiente: str
    inicio: datetime
    fim: datetime
    minha: bool


class ReservaReagendar(BaseModel):
    inicio: datetime

    @field_validator("inicio")
    @classmethod
    def validar_inicio(cls, valor: datetime):
        if valor.tzinfo is None:
            raise ValueError("O horário precisa informar o fuso.")
        horario_local = valor.astimezone(ZoneInfo("America/Fortaleza"))
        if horario_local.minute != 0 or horario_local.hour not in range(8, 22, 2):
            raise ValueError("Selecione um dos horários disponíveis.")
        return valor


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
    invitation_id: str | None = None
    clerk_user_id: str | None = None

    @model_validator(mode="after")
    def validar_destino(self):
        if not self.invitation_id and not self.clerk_user_id:
            raise ValueError("Informe o convite ou o usuário existente.")
        return self
