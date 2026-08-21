CREATE TABLE IF NOT EXISTS modulos_condominio (
 id SERIAL PRIMARY KEY,
 condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 chave VARCHAR(40) NOT NULL,
 habilitado BOOLEAN NOT NULL DEFAULT FALSE,
 visivel_moradores BOOLEAN NOT NULL DEFAULT FALSE,
 CONSTRAINT uq_modulo_condominio_chave UNIQUE (condominio_id, chave)
);
CREATE INDEX IF NOT EXISTS ix_modulos_condominio_condominio_id ON modulos_condominio(condominio_id);
INSERT INTO modulos_condominio (condominio_id, chave, habilitado, visivel_moradores)
SELECT c.id, m.chave, TRUE, m.visivel
FROM condominios c
CROSS JOIN (VALUES
 ('chamados', TRUE), ('agendamentos', TRUE), ('atas', TRUE), ('acompanhamento', TRUE),
 ('compras', FALSE), ('estoque', FALSE), ('prestadores', FALSE), ('cronogramas', FALSE)
) AS m(chave, visivel)
ON CONFLICT (condominio_id, chave) DO NOTHING;
