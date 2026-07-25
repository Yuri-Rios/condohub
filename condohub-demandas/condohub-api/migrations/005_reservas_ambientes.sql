CREATE TABLE IF NOT EXISTS reservas_ambientes (
    id SERIAL PRIMARY KEY,
    ambiente VARCHAR(30) NOT NULL,
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ NOT NULL,
    morador_id VARCHAR(255) NOT NULL,
    morador_nome VARCHAR(160) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reserva_ambiente_inicio UNIQUE (ambiente, inicio)
);

CREATE INDEX IF NOT EXISTS ix_reservas_ambientes_ambiente
    ON reservas_ambientes (ambiente);

CREATE INDEX IF NOT EXISTS ix_reservas_ambientes_inicio
    ON reservas_ambientes (inicio);

CREATE INDEX IF NOT EXISTS ix_reservas_ambientes_morador_id
    ON reservas_ambientes (morador_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_ambiente_inicio
    ON reservas_ambientes (ambiente, inicio);
