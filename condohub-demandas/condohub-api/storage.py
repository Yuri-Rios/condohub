from dataclasses import dataclass
from typing import Protocol
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import IntegracaoOneDrive
from onedrive import baixar_arquivo, criar_caminho_pastas, enviar_arquivo, excluir_arquivo, renovar_token


@dataclass
class ArquivoSalvo:
    provedor: str
    arquivo_id: str
    armazenamento_id: str
    nome: str
    tamanho: int


class StorageProvider(Protocol):
    def salvar(self, caminho: str, nome: str, conteudo: bytes, mime_type: str) -> ArquivoSalvo: ...
    def baixar(self, armazenamento_id: str, arquivo_id: str): ...
    def excluir(self, armazenamento_id: str, arquivo_id: str) -> None: ...


class OneDriveStorage:
    def __init__(self, integracao: IntegracaoOneDrive):
        self.integracao = integracao

    def salvar(self, caminho: str, nome: str, conteudo: bytes, mime_type: str) -> ArquivoSalvo:
        token = renovar_token(self.integracao)
        pasta = criar_caminho_pastas(token, self.integracao.drive_id, caminho)
        nome_fisico = f"{uuid4().hex}-{nome}"
        arquivo = enviar_arquivo(token, self.integracao.drive_id, pasta["id"], nome_fisico, conteudo, mime_type)
        return ArquivoSalvo("onedrive", arquivo["id"], self.integracao.drive_id, nome, int(arquivo.get("size", len(conteudo))))

    def baixar(self, armazenamento_id: str, arquivo_id: str):
        return baixar_arquivo(renovar_token(self.integracao), armazenamento_id, arquivo_id)

    def excluir(self, armazenamento_id: str, arquivo_id: str) -> None:
        excluir_arquivo(renovar_token(self.integracao), armazenamento_id, arquivo_id)


def obter_storage(banco: Session, condominio_id: int) -> StorageProvider:
    integracao = banco.query(IntegracaoOneDrive).filter(IntegracaoOneDrive.condominio_id == condominio_id, IntegracaoOneDrive.status == "ativa").first()
    if integracao:
        return OneDriveStorage(integracao)
    raise HTTPException(status_code=422, detail="Configure um armazenamento antes de enviar anexos.")
