ALTER TABLE ocorrencias
    ADD COLUMN IF NOT EXISTS autor_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS autor_nome VARCHAR(160),
    ADD COLUMN IF NOT EXISTS autor_avatar_url TEXT;

CREATE INDEX IF NOT EXISTS ix_ocorrencias_autor_id
    ON ocorrencias (autor_id);

CREATE TABLE IF NOT EXISTS mensagens_ocorrencia (
    id SERIAL PRIMARY KEY,
    ocorrencia_id INTEGER NOT NULL
        REFERENCES ocorrencias(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    autor_id VARCHAR(255) NOT NULL,
    autor_nome VARCHAR(160) NOT NULL,
    autor_avatar_url TEXT,
    autor_papeis VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_mensagens_ocorrencia_ocorrencia_id
    ON mensagens_ocorrencia (ocorrencia_id);

CREATE INDEX IF NOT EXISTS ix_mensagens_ocorrencia_autor_id
    ON mensagens_ocorrencia (autor_id);
