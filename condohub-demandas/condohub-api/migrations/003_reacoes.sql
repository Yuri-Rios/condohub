CREATE TABLE IF NOT EXISTS reacoes_mensagem (
    id SERIAL PRIMARY KEY,
    mensagem_id INTEGER NOT NULL
        REFERENCES mensagens_ocorrencia(id) ON DELETE CASCADE,
    usuario_id VARCHAR(255) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reacao_mensagem_usuario_emoji
        UNIQUE (mensagem_id, usuario_id, emoji)
);

CREATE INDEX IF NOT EXISTS ix_reacoes_mensagem_mensagem_id
    ON reacoes_mensagem (mensagem_id);

CREATE INDEX IF NOT EXISTS ix_reacoes_mensagem_usuario_id
    ON reacoes_mensagem (usuario_id);
