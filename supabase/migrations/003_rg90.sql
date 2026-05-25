-- ============================================================
-- SIRS - Migración 003: Campos para RG90 (Paraguay DNIT)
-- Agrega timbrado y tasa_iva a la tabla ventas
-- ============================================================

-- Número de timbrado SET (obligatorio para facturación formal en Paraguay)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS timbrado TEXT;

-- Tasa de IVA aplicada al comprobante: 10, 5, o 0 (exento)
-- Paraguay maneja IVA 10% general y 5% para productos básicos
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tasa_iva NUMERIC(5,2) NOT NULL DEFAULT 10;

-- Índice para consultas RG90 por período
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_rg90 ON ventas (fecha, estado, timbrado);
