CREATE TABLE IF NOT EXISTS notificacoes_ocorrencia (
    id SERIAL PRIMARY KEY,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    ocorrencia_id INTEGER NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
    destinatario_id VARCHAR(255) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    ator_id VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lida_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_notificacoes_ocorrencia_condominio_id
    ON notificacoes_ocorrencia(condominio_id);
CREATE INDEX IF NOT EXISTS ix_notificacoes_ocorrencia_ocorrencia_id
    ON notificacoes_ocorrencia(ocorrencia_id);
CREATE INDEX IF NOT EXISTS ix_notificacoes_ocorrencia_destinatario_id
    ON notificacoes_ocorrencia(destinatario_id);
CREATE INDEX IF NOT EXISTS ix_notificacoes_ocorrencia_lida_em
    ON notificacoes_ocorrencia(lida_em);
CREATE INDEX IF NOT EXISTS ix_notificacoes_ocorrencia_pendentes
    ON notificacoes_ocorrencia(condominio_id, destinatario_id)
    WHERE lida_em IS NULL;
