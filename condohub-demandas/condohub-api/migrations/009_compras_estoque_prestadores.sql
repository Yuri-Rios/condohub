CREATE TABLE IF NOT EXISTS pedidos_compra (
 id SERIAL PRIMARY KEY, condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 item VARCHAR(160) NOT NULL, quantidade NUMERIC(12,3) NOT NULL, unidade VARCHAR(30) NOT NULL,
 justificativa TEXT NOT NULL, valor_estimado NUMERIC(12,2), status VARCHAR(30) NOT NULL DEFAULT 'solicitado',
 solicitante_id VARCHAR(255) NOT NULL, solicitante_nome VARCHAR(160) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_pedidos_compra_condominio_id ON pedidos_compra(condominio_id);
CREATE TABLE IF NOT EXISTS historico_pedidos_compra (
 id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
 status VARCHAR(30) NOT NULL, observacao TEXT, autor_id VARCHAR(255) NOT NULL, autor_nome VARCHAR(160) NOT NULL,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_historico_pedidos_pedido_id ON historico_pedidos_compra(pedido_id);
CREATE TABLE IF NOT EXISTS compras (
 id SERIAL PRIMARY KEY, condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 pedido_id INTEGER REFERENCES pedidos_compra(id) ON DELETE SET NULL, item VARCHAR(160) NOT NULL,
 quantidade NUMERIC(12,3) NOT NULL, unidade VARCHAR(30) NOT NULL, fornecedor VARCHAR(160),
 valor_total NUMERIC(12,2) NOT NULL, observacao TEXT, comprado_por_id VARCHAR(255) NOT NULL,
 comprado_por_nome VARCHAR(160) NOT NULL, data_compra TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_compras_condominio_id ON compras(condominio_id);
CREATE INDEX IF NOT EXISTS ix_compras_pedido_id ON compras(pedido_id);
CREATE TABLE IF NOT EXISTS itens_estoque (
 id SERIAL PRIMARY KEY, condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 nome VARCHAR(160) NOT NULL, unidade VARCHAR(30) NOT NULL, quantidade NUMERIC(12,3) NOT NULL DEFAULT 0,
 estoque_minimo NUMERIC(12,3), localizacao VARCHAR(160), criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_itens_estoque_condominio_id ON itens_estoque(condominio_id);
CREATE TABLE IF NOT EXISTS movimentos_estoque (
 id SERIAL PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES itens_estoque(id) ON DELETE CASCADE,
 tipo VARCHAR(20) NOT NULL, quantidade NUMERIC(12,3) NOT NULL, observacao TEXT,
 ocorrencia_id INTEGER REFERENCES ocorrencias(id) ON DELETE SET NULL,
 pedido_id INTEGER REFERENCES pedidos_compra(id) ON DELETE SET NULL,
 autor_id VARCHAR(255) NOT NULL, autor_nome VARCHAR(160) NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_movimentos_estoque_item_id ON movimentos_estoque(item_id);
CREATE TABLE IF NOT EXISTS prestadores_servico (
 id SERIAL PRIMARY KEY, condominio_id INTEGER NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 nome VARCHAR(160) NOT NULL, especialidade VARCHAR(160) NOT NULL, telefone VARCHAR(60), email VARCHAR(320),
 documento VARCHAR(60), observacoes TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_prestadores_condominio_id ON prestadores_servico(condominio_id);
CREATE TABLE IF NOT EXISTS atendimentos_prestador (
 id SERIAL PRIMARY KEY, prestador_id INTEGER NOT NULL REFERENCES prestadores_servico(id) ON DELETE CASCADE,
 ocorrencia_id INTEGER NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE, observacao TEXT,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT uq_atendimento_prestador_ocorrencia UNIQUE(prestador_id, ocorrencia_id)
);
CREATE INDEX IF NOT EXISTS ix_atendimentos_prestador_id ON atendimentos_prestador(prestador_id);
