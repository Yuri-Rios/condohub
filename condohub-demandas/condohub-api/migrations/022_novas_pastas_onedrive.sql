ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS contratos_root_item_id VARCHAR(255);
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS contratos_root_path TEXT;
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS certificados_root_item_id VARCHAR(255);
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS certificados_root_path TEXT;
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS memoriais_root_item_id VARCHAR(255);
ALTER TABLE integracoes_onedrive ADD COLUMN IF NOT EXISTS memoriais_root_path TEXT;
