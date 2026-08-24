INSERT INTO modulos_condominio (condominio_id, chave, habilitado, visivel_moradores)
SELECT c.id, novo.chave, COALESCE(f.habilitado, TRUE), COALESCE(f.visivel_moradores, TRUE)
FROM condominios c
CROSS JOIN (VALUES ('contratos'), ('certificados'), ('memorial')) AS novo(chave)
LEFT JOIN modulos_condominio f ON f.condominio_id = c.id AND f.chave = 'financeiro'
ON CONFLICT (condominio_id, chave) DO NOTHING;
