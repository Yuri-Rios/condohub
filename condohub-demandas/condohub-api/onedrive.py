import os
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode

import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from models import IntegracaoOneDrive

GRAPH_URL = "https://graph.microsoft.com/v1.0"
LOGIN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0"
SCOPES = "openid profile offline_access Files.ReadWrite User.Read"


def _config(nome: str) -> str:
    valor = os.getenv(nome)
    if not valor:
        raise HTTPException(status_code=503, detail=f"Integração Microsoft não configurada: {nome}.")
    return valor


def _fernet() -> Fernet:
    try:
        return Fernet(_config("MICROSOFT_TOKEN_ENCRYPTION_KEY").encode())
    except ValueError as erro:
        raise HTTPException(status_code=503, detail="MICROSOFT_TOKEN_ENCRYPTION_KEY inválida.") from erro


def criptografar_token(token: str) -> str:
    return _fernet().encrypt(token.encode()).decode()


def descriptografar_token(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as erro:
        raise HTTPException(status_code=503, detail="Não foi possível abrir a credencial do OneDrive.") from erro


def criar_estado(condominio_id: int, usuario_id: str) -> str:
    agora = datetime.now(timezone.utc)
    return jwt.encode(
        {"condominio_id": condominio_id, "usuario_id": usuario_id, "iat": agora, "exp": agora + timedelta(minutes=10)},
        _config("MICROSOFT_OAUTH_STATE_SECRET"),
        algorithm="HS256",
    )


def ler_estado(estado: str) -> dict:
    try:
        return jwt.decode(estado, _config("MICROSOFT_OAUTH_STATE_SECRET"), algorithms=["HS256"])
    except jwt.PyJWTError as erro:
        raise HTTPException(status_code=400, detail="Autorização Microsoft inválida ou expirada.") from erro


def url_autorizacao(estado: str) -> str:
    parametros = urlencode(
        {
            "client_id": _config("MICROSOFT_CLIENT_ID"),
            "response_type": "code",
            "redirect_uri": _config("MICROSOFT_REDIRECT_URI"),
            "response_mode": "query",
            "scope": SCOPES,
            "state": estado,
            "prompt": "select_account",
        }
    )
    return f"{LOGIN_URL}/authorize?{parametros}"


def trocar_codigo(codigo: str) -> dict:
    resposta = httpx.post(
        f"{LOGIN_URL}/token",
        data={
            "client_id": _config("MICROSOFT_CLIENT_ID"),
            "client_secret": _config("MICROSOFT_CLIENT_SECRET"),
            "code": codigo,
            "redirect_uri": _config("MICROSOFT_REDIRECT_URI"),
            "grant_type": "authorization_code",
            "scope": SCOPES,
        },
        timeout=20,
    )
    if resposta.is_error:
        raise HTTPException(status_code=400, detail="A Microsoft não autorizou a conexão com o OneDrive.")
    dados = resposta.json()
    if not dados.get("refresh_token"):
        raise HTTPException(status_code=400, detail="A Microsoft não concedeu acesso offline. Refaça a conexão e aceite as permissões solicitadas.")
    return dados


def renovar_token(integracao: IntegracaoOneDrive) -> str:
    resposta = httpx.post(
        f"{LOGIN_URL}/token",
        data={
            "client_id": _config("MICROSOFT_CLIENT_ID"),
            "client_secret": _config("MICROSOFT_CLIENT_SECRET"),
            "refresh_token": descriptografar_token(integracao.refresh_token_criptografado),
            "grant_type": "refresh_token",
            "scope": SCOPES,
        },
        timeout=20,
    )
    if resposta.is_error:
        integracao.status = "requer_reconexao"
        raise HTTPException(status_code=401, detail="A conta Microsoft precisa ser conectada novamente.")
    dados = resposta.json()
    if dados.get("refresh_token"):
        integracao.refresh_token_criptografado = criptografar_token(dados["refresh_token"])
    integracao.escopos = dados.get("scope", integracao.escopos)
    return dados["access_token"]


def graph_get(token: str, caminho: str, *, seguir_redirecionamento: bool = False, timeout: float = 30) -> httpx.Response:
    resposta = httpx.get(
        f"{GRAPH_URL}{caminho}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=timeout,
        follow_redirects=seguir_redirecionamento,
    )
    if resposta.is_error:
        detalhe = resposta.json().get("error", {}).get("message", "Falha ao acessar o OneDrive.")
        raise HTTPException(status_code=502, detail=detalhe)
    return resposta


def graph_post(token: str, caminho: str, dados: dict) -> dict:
    resposta = httpx.post(f"{GRAPH_URL}{caminho}", headers={"Authorization": f"Bearer {token}"}, json=dados, timeout=30)
    if resposta.is_error:
        detalhe = resposta.json().get("error", {}).get("message", "Falha ao gravar no OneDrive.")
        raise HTTPException(status_code=502, detail=detalhe)
    return resposta.json()


def obter_perfil_drive(access_token: str) -> tuple[dict, dict]:
    perfil = graph_get(access_token, "/me?$select=id,displayName,mail,userPrincipalName").json()
    drive = graph_get(access_token, "/me/drive?$select=id,driveType,owner").json()
    return perfil, drive


def resolver_pasta(token: str, caminho: str) -> dict:
    if caminho == "/":
        return graph_get(token, "/me/drive/root?$select=id,name,parentReference").json()
    caminho_codificado = quote(caminho.strip("/"), safe="/")
    return graph_get(token, f"/me/drive/root:/{caminho_codificado}?$select=id,name,parentReference").json()


def listar_pastas(token: str, drive_id: str, pasta_id: str) -> list[dict]:
    caminho = f"/drives/{quote(drive_id, safe='')}/items/{quote(pasta_id, safe='')}/children?$select=id,name,folder&$top=200"
    pastas: list[dict] = []
    while caminho:
        dados = graph_get(token, caminho).json()
        pastas.extend(
            {"id": item["id"], "nome": item.get("name", "")}
            for item in dados.get("value", [])
            if item.get("folder") is not None
        )
        proxima = dados.get("@odata.nextLink")
        caminho = proxima.removeprefix(GRAPH_URL) if proxima else ""
    return sorted(pastas, key=lambda pasta: pasta["nome"].casefold())


def listar_conteudo(token: str, drive_id: str, pasta_id: str) -> tuple[list[dict], list[str]]:
    itens: list[dict] = []
    caminhos_pastas: list[str] = []
    pastas = [(pasta_id, "")]
    while pastas:
        atual, caminho_relativo = pastas.pop()
        caminho = f"/drives/{quote(drive_id, safe='')}/items/{quote(atual, safe='')}/children?$select=id,name,size,file,folder,eTag,lastModifiedDateTime,parentReference&$top=200"
        while caminho:
            dados = graph_get(token, caminho).json()
            for item in dados.get("value", []):
                if item.get("folder") is not None:
                    proximo_caminho = "/".join(parte for parte in [caminho_relativo, item.get("name", "")] if parte)
                    caminhos_pastas.append(proximo_caminho)
                    pastas.append((item["id"], proximo_caminho))
                else:
                    item["_caminho_relativo"] = caminho_relativo
                    itens.append(item)
                if len(itens) + len(pastas) > 5000:
                    raise HTTPException(status_code=413, detail="A pasta possui itens demais para a importação do MVP.")
            proxima = dados.get("@odata.nextLink")
            caminho = proxima.removeprefix(GRAPH_URL) if proxima else ""
    return itens, caminhos_pastas


def listar_arquivos(token: str, drive_id: str, pasta_id: str) -> list[dict]:
    return listar_conteudo(token, drive_id, pasta_id)[0]


def baixar_arquivo(token: str, drive_id: str, item_id: str) -> httpx.Response:
    return graph_get(
        token,
        f"/drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}/content",
        seguir_redirecionamento=True,
        timeout=60,
    )


def criar_caminho_pastas(token: str, drive_id: str, caminho: str) -> dict:
    atual = graph_get(token, f"/drives/{quote(drive_id, safe='')}/root?$select=id,name").json()
    for nome in [parte for parte in caminho.strip("/").split("/") if parte]:
        codificado = quote(nome, safe="")
        busca = httpx.get(f"{GRAPH_URL}/drives/{quote(drive_id, safe='')}/items/{quote(atual['id'], safe='')}:/{codificado}", headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if busca.status_code == 404:
            atual = graph_post(token, f"/drives/{quote(drive_id, safe='')}/items/{quote(atual['id'], safe='')}/children", {"name": nome, "folder": {}, "@microsoft.graph.conflictBehavior": "fail"})
        elif busca.is_error:
            detalhe = busca.json().get("error", {}).get("message", "Falha ao localizar pasta no OneDrive.")
            raise HTTPException(status_code=502, detail=detalhe)
        else:
            atual = busca.json()
    return atual


def enviar_arquivo(token: str, drive_id: str, pasta_id: str, nome: str, conteudo: bytes, mime_type: str) -> dict:
    resposta = httpx.put(
        f"{GRAPH_URL}/drives/{quote(drive_id, safe='')}/items/{quote(pasta_id, safe='')}:/{quote(nome, safe='')}:/content",
        headers={"Authorization": f"Bearer {token}", "Content-Type": mime_type}, content=conteudo, timeout=60,
    )
    if resposta.is_error:
        detalhe = resposta.json().get("error", {}).get("message", "Falha ao enviar arquivo ao OneDrive.")
        raise HTTPException(status_code=502, detail=detalhe)
    return resposta.json()


def excluir_arquivo(token: str, drive_id: str, item_id: str):
    resposta = httpx.delete(f"{GRAPH_URL}/drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if resposta.status_code not in {204, 404}:
        detalhe = resposta.json().get("error", {}).get("message", "Falha ao excluir arquivo do OneDrive.")
        raise HTTPException(status_code=502, detail=detalhe)
