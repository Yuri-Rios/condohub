CREATE TABLE IF NOT EXISTS anexos_ocorrencia (
 id SERIAL PRIMARY KEY,
 ocorrencia_id INTEGER NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
 provedor VARCHAR(30) NOT NULL,
 arquivo_externo_id VARCHAR(255) NOT NULL,
 armazenamento_id VARCHAR(255) NOT NULL,
 nome VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 tamanho INTEGER NOT NULL,
 autor_id VARCHAR(255) NOT NULL,
 autor_nome VARCHAR(160) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_anexos_ocorrencia_ocorrencia_id ON anexos_ocorrencia(ocorrencia_id);
CREATE INDEX IF NOT EXISTS ix_anexos_ocorrencia_autor_id ON anexos_ocorrencia(autor_id);
