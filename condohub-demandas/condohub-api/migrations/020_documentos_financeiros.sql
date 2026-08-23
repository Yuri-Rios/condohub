ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS balancetes_root_item_id VARCHAR(255);
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS balancetes_root_path TEXT;
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS orcamentos_root_item_id VARCHAR(255);
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS orcamentos_root_path TEXT;
CREATE TABLE IF NOT EXISTS documentos_financeiros (
 id SERIAL PRIMARY KEY,
 condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 tipo VARCHAR(30) NOT NULL,
 titulo VARCHAR(255) NOT NULL,
 competencia DATE,
 descricao TEXT,
 drive_id VARCHAR(255) NOT NULL,
 drive_item_id VARCHAR(255) NOT NULL,
 nome_arquivo VARCHAR(255) NOT NULL,
 mime_type VARCHAR(160),
 tamanho INTEGER,
 etag TEXT,
 modificado_em TIMESTAMPTZ,
 publicado BOOLEAN NOT NULL DEFAULT FALSE,
 publicado_em TIMESTAMPTZ,
 publicado_por VARCHAR(255),
 importado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT uq_documento_financeiro_item UNIQUE (condominio_id, tipo, drive_id, drive_item_id)
);
CREATE INDEX IF NOT EXISTS ix_documentos_financeiros_condominio_tipo ON documentos_financeiros(condominio_id, tipo);
CREATE INDEX IF NOT EXISTS ix_documentos_financeiros_publicado ON documentos_financeiros(publicado);
INSERT INTO modulos_condominio (condominio_id, chave, habilitado, visivel_moradores)
SELECT id, 'financeiro', TRUE, TRUE FROM condominios
ON CONFLICT (condominio_id, chave) DO NOTHING;
