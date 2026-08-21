CREATE TABLE IF NOT EXISTS cronogramas (
 id SERIAL PRIMARY KEY,
 condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 titulo VARCHAR(160) NOT NULL,
 categoria VARCHAR(60) NOT NULL,
 objetivo TEXT NOT NULL,
 responsavel VARCHAR(160) NOT NULL,
 inicio_previsto DATE NOT NULL,
 fim_previsto DATE NOT NULL,
 prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
 orcamento_previsto NUMERIC(12,2),
 status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
 criado_por_id VARCHAR(255) NOT NULL,
 criado_por_nome VARCHAR(160) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cronogramas_condominio_id ON cronogramas(condominio_id);
CREATE INDEX IF NOT EXISTS ix_cronogramas_status ON cronogramas(status);
CREATE TABLE IF NOT EXISTS etapas_cronograma (
 id SERIAL PRIMARY KEY,
 cronograma_id INTEGER NOT NULL REFERENCES cronogramas(id) ON DELETE CASCADE,
 ordem INTEGER NOT NULL,
 titulo VARCHAR(160) NOT NULL,
 responsavel VARCHAR(160) NOT NULL,
 inicio_previsto DATE NOT NULL,
 fim_previsto DATE NOT NULL,
 custo_previsto NUMERIC(12,2),
 status VARCHAR(20) NOT NULL DEFAULT 'planejada'
);
CREATE INDEX IF NOT EXISTS ix_etapas_cronograma_cronograma_id ON etapas_cronograma(cronograma_id);
