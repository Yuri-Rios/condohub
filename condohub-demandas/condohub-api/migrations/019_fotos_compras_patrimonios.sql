CREATE TABLE IF NOT EXISTS anexos_pedido_compra (
 id SERIAL PRIMARY KEY,
 pedido_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
 provedor VARCHAR(30) NOT NULL,
 arquivo_externo_id VARCHAR(255) NOT NULL,
 armazenamento_id VARCHAR(255) NOT NULL,
 nome VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 tamanho INTEGER NOT NULL,
 autor_id VARCHAR(255) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_anexos_pedido_compra_pedido_id ON anexos_pedido_compra(pedido_id);
CREATE TABLE IF NOT EXISTS fotos_patrimonio (
 id SERIAL PRIMARY KEY,
 patrimonio_id INTEGER NOT NULL UNIQUE REFERENCES patrimonios(id) ON DELETE CASCADE,
 provedor VARCHAR(30) NOT NULL,
 arquivo_externo_id VARCHAR(255) NOT NULL,
 armazenamento_id VARCHAR(255) NOT NULL,
 nome VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 tamanho INTEGER NOT NULL,
 autor_id VARCHAR(255) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_fotos_patrimonio_patrimonio_id ON fotos_patrimonio(patrimonio_id);
