CREATE TABLE IF NOT EXISTS patrimonios (
 id SERIAL PRIMARY KEY,
 condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 numero VARCHAR(30),
 nome VARCHAR(160) NOT NULL,
 categoria VARCHAR(80) NOT NULL,
 localizacao VARCHAR(160) NOT NULL,
 descricao TEXT,
 valor_aquisicao NUMERIC(12, 2),
 data_aquisicao DATE NOT NULL DEFAULT CURRENT_DATE,
 nota_fiscal VARCHAR(100),
 estado VARCHAR(30) NOT NULL DEFAULT 'bom',
 foto_data_url TEXT,
 cadastrado_por_id VARCHAR(255) NOT NULL,
 cadastrado_por_nome VARCHAR(160) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT uq_patrimonio_condominio_numero UNIQUE (condominio_id, numero)
);
CREATE INDEX IF NOT EXISTS ix_patrimonios_condominio_id ON patrimonios(condominio_id);
INSERT INTO modulos_condominio (condominio_id, chave, habilitado, visivel_moradores)
SELECT id, 'patrimonio', TRUE, FALSE FROM condominios
ON CONFLICT (condominio_id, chave) DO NOTHING;
