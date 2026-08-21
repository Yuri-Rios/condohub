CREATE TABLE IF NOT EXISTS integracoes_onedrive (
    id SERIAL PRIMARY KEY,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    microsoft_account_id VARCHAR(255) NOT NULL,
    microsoft_email VARCHAR(320),
    drive_id VARCHAR(255) NOT NULL,
    root_item_id VARCHAR(255) NOT NULL,
    root_path TEXT NOT NULL,
    refresh_token_criptografado TEXT NOT NULL,
    escopos TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ativa',
    conectado_por VARCHAR(255) NOT NULL,
    conectado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_sincronizacao_em TIMESTAMPTZ,
    erro_ultima_sincronizacao TEXT,
    CONSTRAINT uq_integracao_onedrive_condominio UNIQUE (condominio_id)
);

CREATE INDEX IF NOT EXISTS ix_integracoes_onedrive_condominio_id ON integracoes_onedrive(condominio_id);

CREATE TABLE IF NOT EXISTS atas (
    id SERIAL PRIMARY KEY,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'assembleia',
    data_assembleia TIMESTAMPTZ,
    descricao TEXT,
    drive_id VARCHAR(255) NOT NULL,
    drive_item_id VARCHAR(255) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    mime_type VARCHAR(160),
    tamanho INTEGER,
    etag TEXT,
    modificado_em TIMESTAMPTZ,
    publicada BOOLEAN NOT NULL DEFAULT FALSE,
    publicado_em TIMESTAMPTZ,
    publicado_por VARCHAR(255),
    importado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ata_item_onedrive UNIQUE (condominio_id, drive_id, drive_item_id)
);

CREATE INDEX IF NOT EXISTS ix_atas_condominio_id ON atas(condominio_id);
CREATE INDEX IF NOT EXISTS ix_atas_publicada ON atas(publicada);
CREATE INDEX IF NOT EXISTS ix_atas_condominio_publicada ON atas(condominio_id, publicada);
