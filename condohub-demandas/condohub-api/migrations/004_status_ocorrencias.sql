ALTER TABLE ocorrencias
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'novo';

CREATE INDEX IF NOT EXISTS ix_ocorrencias_status
    ON ocorrencias (status);
