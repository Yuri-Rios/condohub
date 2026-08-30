import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

# Importa a API sem iniciar lifespan/migrações nem usar o banco configurado.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "condohub-api"))
import main
import onedrive


class DownloadTests(unittest.TestCase):
    def test_obtem_somente_metadados(self):
        url = "https://example.invalid/temporario.pdf"
        response = Mock()
        response.json.return_value = {"@microsoft.graph.downloadUrl": url}
        with patch.object(onedrive, "graph_get", return_value=response) as graph:
            self.assertEqual(onedrive.obter_url_download("token", "drive/id", "item/id"), url)
        graph.assert_called_once_with("token", "/drives/drive%2Fid/items/item%2Fid?$select=id,@microsoft.graph.downloadUrl")

    def test_link_ausente(self):
        response = Mock()
        response.json.return_value = {}
        with patch.object(onedrive, "graph_get", return_value=response):
            with self.assertRaises(main.HTTPException) as error:
                onedrive.obter_url_download("token", "drive", "item")
        self.assertEqual(error.exception.status_code, 502)

    def test_rotas_autorizam_antes_de_retornar_link(self):
        for route in [main.obter_arquivo_ata, main.obter_arquivo_documento_financeiro]:
            for published, roles, allowed in [(True, {"morador"}, True), (False, {"morador"}, False), (False, {"sindico"}, True)]:
                with self.subTest(route=route.__name__, published=published, roles=roles):
                    document = SimpleNamespace(publicada=published, publicado=published, drive_id="drive", drive_item_id="item", tipo="balancetes")
                    bank = Mock()
                    bank.query.return_value.filter.return_value.first.return_value = document
                    user = SimpleNamespace(condominio_id=1, papeis=roles)
                    with patch.object(main, "_integracao_onedrive"), patch.object(main, "renovar_token", return_value="token"), patch.object(main, "_exigir_modulo_documento"), patch.object(main, "obter_url_download", return_value="https://example.invalid/temporario.pdf") as download:
                        if allowed:
                            response = route(1, banco=bank, usuario=user)
                            self.assertEqual(response.status_code, 302)
                            self.assertEqual(response.headers["location"], "https://example.invalid/temporario.pdf")
                            self.assertEqual(response.headers["cache-control"], "no-store")
                            self.assertEqual(response.body, b"")
                            download.assert_called_once_with("token", "drive", "item")
                            bank.commit.assert_called_once()
                        else:
                            with self.assertRaises(main.HTTPException) as error:
                                route(1, banco=bank, usuario=user)
                            self.assertEqual(error.exception.status_code, 404)
                            download.assert_not_called()


if __name__ == "__main__":
    unittest.main()
