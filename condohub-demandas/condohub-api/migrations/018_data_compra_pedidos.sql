ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS data_compra DATE;
UPDATE pedidos_compra SET data_compra = CAST(criado_em AS DATE) WHERE data_compra IS NULL;
ALTER TABLE pedidos_compra ALTER COLUMN data_compra SET DEFAULT CURRENT_DATE;
ALTER TABLE pedidos_compra ALTER COLUMN data_compra SET NOT NULL;
