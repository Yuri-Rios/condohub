CREATE TABLE IF NOT EXISTS administradores_plataforma (
    id SERIAL PRIMARY KEY,
    clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE administradores_plataforma
    ALTER COLUMN criado_em SET DEFAULT NOW();

INSERT INTO administradores_plataforma (clerk_user_id, criado_em)
SELECT DISTINCT clerk_user_id, NOW()
FROM membros_condominio
WHERE (',' || papeis || ',') LIKE '%,admin,%'
ON CONFLICT (clerk_user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_administradores_plataforma_clerk_user_id
    ON administradores_plataforma (clerk_user_id);
