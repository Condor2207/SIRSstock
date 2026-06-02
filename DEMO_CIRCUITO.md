# 🎯 Circuito Demo — SIRS Stock

Recorrido básico de 0 a 100 para mostrar el sistema en acción.

---

## 1. Configuración inicial (2 min)

> *"Antes de operar, el sistema necesita datos maestros."*

1. **Configuración → Empresa** — completar nombre, RUC, dirección
2. **Configuración → Tasas IVA** — confirmar que existen 5%, 10%, Exento
3. **Configuración → Unidades** — mostrar "Kg", "Unidad", "Litro"
4. **Configuración → Listas de precios** — mostrar "Precio Mayorista", "Precio Minorista"
5. **Configuración → Vendedores** — crear un vendedor: *Juan Pérez, 5% comisión*

---

## 2. Alta de Proveedor (1 min)

> *"Registramos de quién compramos."*

1. Ir a **Proveedores → Nuevo**
2. Completar:
   - Nombre: `Distribuidora ABC`
   - RUC: `80012345-1`
   - Teléfono: `0981-123456`
3. Guardar ✅

---

## 3. Alta de Producto (2 min)

> *"El corazón del sistema."*

1. Ir a **Productos → Nuevo**
2. Tab **Datos generales**:
   - SKU: `PROD-001`
   - Nombre: `Azúcar Blanca 1kg`
   - Clasificación, Unidad: `Kg`, IVA: `10%`
   - Precio compra: `8.000`, Precio venta: `12.000`
   - Stock mínimo: `10`
   - Activar **Control de lote**
3. Tab **Precios por lista** — poner precio mayorista diferente
4. Guardar ✅
5. *Mostrar que aparece en la tabla con los datos*

---

## 4. Registrar una Compra (3 min)

> *"Ingresamos mercadería al stock."*

1. Ir a **Compras → Nueva compra**
2. Seleccionar proveedor: `Distribuidora ABC` (usar buscador)
3. Condición: `Contado`
4. Agregar ítem:
   - Producto: `Azúcar Blanca 1kg` (buscador)
   - Cantidad: `50`
   - Precio: `8.000`
   - Lote: `L-2026-001`, Vencimiento: `2027-06-01`
5. Ver **Total: Gs. 400.000**
6. **Confirmar compra** ✅
7. *Ir a Stock → mostrar que el producto tiene ahora 50 unidades en stock*

---

## 5. Alta de Cliente (1 min)

> *"A quién le vendemos."*

1. Ir a **Clientes → Nuevo**
2. Completar:
   - Nombre: `Supermercado XYZ`
   - RUC: `90056789-0`
   - Límite de crédito: `500.000`
   - Lista de precios: `Precio Mayorista`
   - Vendedor asignado: `Juan Pérez`
3. Guardar ✅

---

## 6. Registrar una Venta (3 min)

> *"El flujo principal del negocio."*

1. Ir a **Ventas → Nueva venta**
2. Seleccionar cliente: `Supermercado XYZ` — *mostrar que aparece el RUC/CI automático*
3. Ver crédito disponible
4. Agregar ítem:
   - Producto: `Azúcar Blanca 1kg`
   - Cantidad: `20`
   - *Precio se autocompleta desde lista del cliente*
5. Ver subtotal, IVA desglosado, total
6. **Confirmar venta** ✅
7. *Ir a Stock → mostrar que bajó de 50 a 30*

---

## 7. Cobros (2 min)

> *"Seguimiento de lo que nos deben."*

1. Ir a **Cobros**
2. Seleccionar cliente: `Supermercado XYZ`
3. Ver la factura pendiente
4. Registrar cobro parcial o total
5. *Mostrar saldo actualizado*

---

## 8. Gastos (1 min)

> *"Registramos los egresos del negocio."*

1. Ir a **Gastos → Nuevo**
2. Título: `Alquiler local`, Monto: `1.500.000`
3. Medio de pago: `Transferencia` → aparece campo N° Transacción
4. Cambiar a `Cheque` → aparecen N° Cheque + Banco + Fecha cobro
5. Guardar con `Efectivo` ✅

---

## 9. Stock y Alertas (1 min)

> *"Control en tiempo real."*

1. Ir a **Stock**
2. Mostrar el producto con lote visible
3. *Si hubiera stock bajo → badge rojo*
4. *Si hubiera lote por vencer → badge naranja*
5. Hacer un **Ajuste de stock** (+/−) con motivo

---

## 10. Comisiones (1 min)

> *"Cálculo automático por venta."*

1. Ir a **Comisiones**
2. Filtrar por rango de fechas (desde/hasta)
3. Ver la comisión generada de `Juan Pérez` por la venta
4. Marcar como **Pagada** ✅

---

## 11. Reportes (2 min)

> *"La información resumida para tomar decisiones."*

1. Ir a **Reportes**
2. Tab **Ventas** — gráfico del período, total y cantidad
3. Tab **Stock** — ver productos con stock bajo destacados
4. Tab **Cuentas a cobrar** — barra de crédito por cliente
5. Tab **RG90** → botón para abrir el libro fiscal

---

## Puntos a destacar durante la demo

| Función | Valor a mostrar |
|---|---|
| SearchSelect | Escribir en el combo → filtra instantáneo |
| Paginación | Cambiar a 25/50 registros por página |
| Ordenamiento | Click en encabezado de columna |
| Tab Exportación | Marcar "Es exportación" → aparece tab con campos en inglés |
| Fecha vencimiento calculada | Cambiar meses → fecha se actualiza sola |
| Campos dinámicos en Gastos | Cambiar medio de pago → campos aparecen/desaparecen |
| Dark/Light mode | Toggle arriba a la derecha |

---

## Tiempo total estimado: ~18 minutos
