CREATE TABLE IF NOT EXISTS modelos_cronograma (
 id SERIAL PRIMARY KEY,
 condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 nome VARCHAR(160) NOT NULL,
 categoria VARCHAR(60) NOT NULL,
 objetivo TEXT NOT NULL,
 prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
 criado_por_id VARCHAR(255) NOT NULL,
 criado_por_nome VARCHAR(160) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT uq_modelo_cronograma_nome UNIQUE (condominio_id, nome)
);
CREATE INDEX IF NOT EXISTS ix_modelos_cronograma_condominio_id ON modelos_cronograma(condominio_id);
CREATE TABLE IF NOT EXISTS etapas_modelo_cronograma (
 id SERIAL PRIMARY KEY,
 modelo_id INTEGER NOT NULL REFERENCES modelos_cronograma(id) ON DELETE CASCADE,
 ordem INTEGER NOT NULL,
 titulo VARCHAR(160) NOT NULL,
 responsavel_sugerido VARCHAR(160),
 duracao_dias INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_etapas_modelo_cronograma_modelo_id ON etapas_modelo_cronograma(modelo_id);
