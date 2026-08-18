-- Líneas y grupos se administran una sola vez y pueden asociarse a varias marcas.
CREATE TABLE IF NOT EXISTS marca_lineas (
  marca_id UUID NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  linea_id UUID NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (marca_id, linea_id)
);

CREATE TABLE IF NOT EXISTS marca_grupos (
  marca_id UUID NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (marca_id, grupo_id)
);

-- Conserva las asociaciones que ya existían en la jerarquía anterior.
INSERT INTO marca_lineas (marca_id, linea_id)
SELECT marca_id, id FROM lineas WHERE marca_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO marca_grupos (marca_id, grupo_id)
SELECT l.marca_id, g.id
FROM grupos g
JOIN lineas l ON l.id = g.linea_id
WHERE l.marca_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Las columnas antiguas ya no definen la pertenencia: las asociaciones
-- anteriores quedaron copiadas en las tablas puente para que los catálogos
-- puedan reutilizarse sin depender de una marca o línea específica.
UPDATE lineas SET marca_id = NULL WHERE marca_id IS NOT NULL;
UPDATE grupos SET linea_id = NULL WHERE linea_id IS NOT NULL;

ALTER TABLE marca_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE marca_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_marca_lineas" ON marca_lineas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_marca_grupos" ON marca_grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);
