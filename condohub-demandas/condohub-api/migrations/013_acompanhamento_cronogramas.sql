ALTER TABLE cronogramas ADD COLUMN IF NOT EXISTS publicado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cronogramas ADD COLUMN IF NOT EXISTS ultima_atualizacao TEXT;
ALTER TABLE cronogramas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS ix_cronogramas_publicado ON cronogramas(publicado);
UPDATE etapas_cronograma SET status = 'nao_iniciada' WHERE status = 'planejada';
