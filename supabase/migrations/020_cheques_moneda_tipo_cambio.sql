-- Tipo de cambio manual (Gs. por USD) para cheques en USD. Sin tasa fija ni conversión automática.
ALTER TABLE cheques_diferidos ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12,2);
