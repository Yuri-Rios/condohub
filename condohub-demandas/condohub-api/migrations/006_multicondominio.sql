CREATE TABLE IF NOT EXISTS condominios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(160) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE condominios
    ALTER COLUMN criado_em SET DEFAULT NOW();

INSERT INTO condominios (nome, slug, ativo, criado_em)
VALUES ('Condomínio Camila Barbosa', 'camila-barbosa', 1, NOW())
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS membros_condominio (
    id SERIAL PRIMARY KEY,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    clerk_user_id VARCHAR(255) NOT NULL,
    nome VARCHAR(160) NOT NULL,
    papeis VARCHAR(255) NOT NULL,
    bloco VARCHAR(40),
    apartamento VARCHAR(40),
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_membro_condominio_usuario
        UNIQUE (condominio_id, clerk_user_id)
);

ALTER TABLE membros_condominio
    ALTER COLUMN criado_em SET DEFAULT NOW();

ALTER TABLE ocorrencias
    ADD COLUMN IF NOT EXISTS condominio_id INTEGER
    REFERENCES condominios(id) ON DELETE CASCADE;
ALTER TABLE solicitacoes_acesso
    ADD COLUMN IF NOT EXISTS condominio_id INTEGER
    REFERENCES condominios(id) ON DELETE CASCADE;
ALTER TABLE reservas_ambientes
    ADD COLUMN IF NOT EXISTS condominio_id INTEGER
    REFERENCES condominios(id) ON DELETE CASCADE;

UPDATE ocorrencias
SET condominio_id = (SELECT id FROM condominios WHERE slug = 'camila-barbosa')
WHERE condominio_id IS NULL;
UPDATE solicitacoes_acesso
SET condominio_id = (SELECT id FROM condominios WHERE slug = 'camila-barbosa')
WHERE condominio_id IS NULL;
UPDATE reservas_ambientes
SET condominio_id = (SELECT id FROM condominios WHERE slug = 'camila-barbosa')
WHERE condominio_id IS NULL;

ALTER TABLE ocorrencias ALTER COLUMN condominio_id SET NOT NULL;
ALTER TABLE solicitacoes_acesso ALTER COLUMN condominio_id SET NOT NULL;
ALTER TABLE reservas_ambientes ALTER COLUMN condominio_id SET NOT NULL;

DROP INDEX IF EXISTS uq_reserva_ambiente_inicio;
ALTER TABLE reservas_ambientes
    DROP CONSTRAINT IF EXISTS uq_reserva_ambiente_inicio;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_condominio_ambiente_inicio
    ON reservas_ambientes (condominio_id, ambiente, inicio);

CREATE INDEX IF NOT EXISTS ix_ocorrencias_condominio_id
    ON ocorrencias (condominio_id);
CREATE INDEX IF NOT EXISTS ix_solicitacoes_acesso_condominio_id
    ON solicitacoes_acesso (condominio_id);
CREATE INDEX IF NOT EXISTS ix_reservas_ambientes_condominio_id
    ON reservas_ambientes (condominio_id);
CREATE INDEX IF NOT EXISTS ix_membros_condominio_condominio_id
    ON membros_condominio (condominio_id);
CREATE INDEX IF NOT EXISTS ix_membros_condominio_clerk_user_id
    ON membros_condominio (clerk_user_id);
