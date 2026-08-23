from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

MIGRACOES_MULTITENANT = (
    "006_multicondominio.sql",
    "007_admin_plataforma.sql",
    "008_avatar_membros.sql",
    "009_compras_estoque_prestadores.sql",
    "010_notificacoes_ocorrencias.sql",
    "011_onedrive_atas.sql",
    "012_cronogramas.sql",
    "013_acompanhamento_cronogramas.sql",
    "014_modulos_condominio.sql",
    "015_modelos_cronograma.sql",
    "016_anexos_ocorrencias.sql",
    "017_patrimonios.sql",
    "018_data_compra_pedidos.sql",
    "019_fotos_compras_patrimonios.sql",
    "020_documentos_financeiros.sql",
)


def aplicar_migracoes_multitenant(engine: Engine):
    diretorio = Path(__file__).resolve().parent / "migrations"
    with engine.begin() as conexao:
        for nome in MIGRACOES_MULTITENANT:
            conteudo = (diretorio / nome).read_text(encoding="utf-8")
            for comando in conteudo.split(";"):
                if comando.strip():
                    conexao.execute(text(comando))
