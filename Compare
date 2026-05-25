INFORME DE RELEVAMIENTO DE SISTEMA
SIRS — Sistema Integral de Gestión
Teixeira S.A. · San Lorenzo, Paraguay
Versión: 1.0 · Fecha: 21 Mayo 2026 Preparado por: Relevamiento técnico-funcional Destinatarios: Cliente (validación y aprobación) 
INTRODUCCIÓN
Este documento describe en detalle todos los ajustes, ampliaciones y módulos nuevos que requiere el sistema SIRS para adaptarse completamente a la operación de Teixeira S.A. Está ordenado siguiendo el flujo natural de trabajo de la empresa: primero se configura el sistema, luego se cargan los productos, luego se trabaja con clientes y proveedores, luego se opera el día a día (producción, compras, ventas, cobros), y al final se consultan reportes. Cada sección indica exactamente en qué pantalla del sistema actual se aplica el cambio, qué campo se agrega, de qué tipo es y de dónde trae su información.
El sistema actual ya tiene funcionando: Dashboard, Productos, Stock y Lotes, Ventas, Clientes, Proveedores, Compras, Gastos, Producción y Reportes. Todo lo que se describe a continuación son agregados y correcciones sobre esa base existente.
________________________________________
BLOQUE 1 — CONFIGURACIÓN GENERAL DEL SISTEMA
Antes de operar, el sistema necesita un conjunto de pantallas donde se configuran los datos "maestros": las tablas que alimentan todas las listas desplegables del resto del sistema. Hoy esas listas son fijas y el usuario no puede modificarlas. Deben convertirse en administrables. Estas pantallas van agrupadas en una nueva sección del menú lateral llamada "Configuración", con acceso solo para el usuario administrador.
________________________________________
Configuración → Unidades de Medida
Actualmente la lista de unidades de medida está fija en el código (unidad, kg, g, litro, ml, caja, bolsa). Teixeira necesita agregar las suyas propias.
Al revisar la planilla de Control de Producción Líquidos (imagen 3, formulario interno FP-07-01 Rev.05 de la empresa), se observa que el sistema de medición real usa: bolsas (bjs), cajas (cjs), bidones (bid) y litros (lts), con presentaciones como 48x30, 24x100, 12x250, 18x500, 17x600, 5 lts. Estas unidades y sus formas abreviadas no existen hoy en el sistema.
En esta pantalla el administrador podrá crear, editar y desactivar unidades de medida. Cada unidad tiene un nombre completo (por ejemplo "Bolsa") y una abreviatura (por ejemplo "bjs"). Cuando en Productos se elige la unidad de medida de un artículo, el sistema muestra la lista de unidades cargadas aquí.
________________________________________
Configuración → Clasificación de Productos
Esta es una de las configuraciones más importantes porque determina el comportamiento de cada producto en toda la operación. Teixeira maneja tipos de productos que se comportan de forma diferente: algunos se facturan al cliente, otros no; algunos tienen stock, otros no; algunos tienen fecha de vencimiento obligatoria, otros no.
El análisis de los documentos físicos confirma esto con claridad. En la factura N° 0011978 (imagen 2) se ve que solo aparecen los edulcorantes terminados (EDUL KADO STEVIA Y SUCRALOSA, EDUL KADO SUCRALOSA, KADO MIX, etc.) con sus códigos de barra, lotes y vencimientos. Los frascos, tapas y etiquetas que se usan para producirlos nunca aparecen en la factura. Sin embargo, en la planilla de producción (imagen 3) sí están registrados los insumos consumidos. Esta separación es una regla de negocio central del sistema.
Los tipos de clasificación a configurar son cuatro. Mercadería: son los productos terminados que se venden al cliente, aparecen en la factura, tienen stock, tienen lote y tienen fecha de vencimiento obligatoria. Ejemplos: KADO MIX 250ml, KADO 100% Stevia 100ml, Vainilla 70ml. Materia Prima: son los ingredientes que se usan para fabricar los productos terminados, no aparecen nunca en una factura de venta al cliente, tienen stock, pueden tener lote pero no tienen vencimiento obligatorio. Ejemplos: extracto de stevia a granel, eritritol, sucralosa en polvo. Insumo: son los materiales de envase y empaque, no aparecen en la factura de venta, tienen stock, tienen número de lote (confirmado en planilla de producción) pero no tienen fecha de vencimiento. Ejemplos: frascos de vidrio, tapas, etiquetas, cajas de cartón. Servicio: son prestaciones sin stock físico, sí pueden aparecer en una factura de venta, no generan movimientos de inventario. Ejemplos: servicio de transporte, maquila.
En esta pantalla de configuración el administrador ve la lista de clasificaciones y puede editar cuáles de estas reglas aplican a cada una. El sistema no permite eliminarlas, solo desactivarlas.
Qué se requiere: El sistema necesita distinguir el tipo de cada producto porque cada tipo tiene reglas diferentes sobre si puede facturarse, si tiene stock y cómo se comporta en producción.
Las clasificaciones definidas son:
Clasificación	¿Aparece en factura?	¿Tiene stock?	¿Se usa en producción?	Ejemplo en Teixeira
Mercadería	Sí	Sí	Sí (como producto terminado)	Stevia en polvo 50g, Vainilla 100ml
Materia prima	No	Sí	Sí (como insumo)	Extracto de stevia a granel, Eritritol
Insumos	No	Sí	Sí (como insumo)	Frascos, tapas, etiquetas
Servicios	Sí	No (no tiene stock)	No	Fletes, servicios de terceros
Gastos	No	No	No	Luz, alquiler

Lo que hay que hacer en el sistema:
•	Agregar el campo clasificacion en la tabla de productos con los valores: Mercadería, Materia Prima, Insumos, Servicio.
•	En el módulo de Facturación, aplicar la regla: solo los productos clasificados como Mercadería pueden incluirse en una factura de venta al cliente. Los demás tipos no aparecen como opciones al facturar.
•	En el módulo de Producción, todos los tipos excepto Servicios pueden usarse como insumos.
•	Los Servicios no generan movimientos de stock.
Regla específica para lotes: Los Insumos (frascos, tapas) pueden tener lote asignado pero no tienen fecha de vencimiento obligatoria. La tabla de lotes ya soporta fecha de vencimiento nula — hay que asegurarse de que el formulario no la exija para esta clasificación.
Fecha de vencimiento por defecto para Mercadería: Al crear un lote de un producto clasificado como Mercadería, el sistema debe sugerir automáticamente la fecha de vencimiento calculada como fecha de producción + 3 años, con posibilidad de que el operador la modifique.
________________________________________
Configuración → Tasas de IVA
La factura física de Teixeira (imágenes 1 y 2) muestra con absoluta claridad la estructura impositiva de Paraguay: tres columnas separadas llamadas EXENTAS, 5% y 10%. Al pie, la liquidación discrimina cuánto corresponde a IVA 5% y cuánto a IVA 10%, sumando en un TOTAL IVA.
En la factura de ejemplo (imagen 2) todos los edulcorantes están cargados en la columna del 10%, con un IVA total de Gs. 3.239.894 sobre un total de Gs. 35.638.836.
El sistema actualmente no tiene este concepto. Aquí el administrador configura las tasas disponibles: Exento (0%), IVA reducido (5%) e IVA general (10%). Cada tasa tiene una descripción y su porcentaje. Estas tasas aparecen como opción en el formulario de Productos para asignarle a cada artículo la que le corresponde. No se espera que estas tasas cambien frecuentemente, pero deben ser administrables.
________________________________________
Configuración → Listas de Precios
La lista de precios real de Teixeira (imagen 4, actualizada al 19/05/2026) revela la complejidad del esquema de precios que maneja la empresa. No es una lista única: son ocho listas distintas con nombres propios, cada una para un canal o cliente diferente.
Los nombres reales son: CONSUMO (precio máximo al público general), DISTRIBUIDOR (precio para distribuidores), GLORIA (precio especial pactado con el cliente Gloria S.A.C.E.I., que es uno de sus clientes principales confirmado por la factura N° 0011978 de imagen 2), PERSONAL TEIXEIRA (precio para empleados de la empresa), LICITACIÓN (precio para licitaciones públicas o del Estado), BON GUSTO (precio para el cliente Bon Gusto), DEL BOSQUE HORECA (precio para el canal gastronómico del cliente Del Bosque), DEL BOSQUE MINORISTA (precio para ventas minoristas del mismo cliente).
En la imagen 4 se ve que las columnas DISTRIBUIDOR, GLORIA y PERSONAL TEIXEIRA tienen la marca "OK" en el encabezado, lo que significa que esas tres listas están actualmente aprobadas y vigentes. Las demás están en proceso o son de uso puntual.
Un ejemplo concreto del mismo documento: el KADO MIX 30 ML (caja x48 unidades, código de barra 7840505123476, código interno 1000) tiene precio CONSUMO de Gs. 4.800, precio DISTRIBUIDOR de Gs. 4.291, precio GLORIA de Gs. 3.781 y precio PERSONAL TEIXEIRA de Gs. 3.500. Son cuatro precios distintos para el mismo producto.
En esta pantalla de configuración el administrador crea las listas, les asigna un nombre, indica si son en Guaraníes o en Dólares americanos, y si aplican IVA o son exentas (para las listas de exportación). No se cargan los precios aquí, eso se hace desde Productos. Simplemente se crean los nombres de las listas que luego aparecen disponibles.
________________________________________
Configuración → Marcas, Líneas y Grupos
Teixeira organiza su catálogo en niveles. La marca principal es KADO, la económica es ZITO, y existe también BON GUSTO como línea para otro canal. Dentro de KADO hay líneas como Edulcorantes en Polvo, Edulcorantes Líquidos, Vainilla, Mermeladas. Dentro de Edulcorantes Líquidos hay grupos como Mix con Stevia, 100% Stevia, Sucralosa, Stevia y Sucralosa.
Esta jerarquía de tres niveles (Marca → Línea → Grupo) permite filtrar y agrupar productos en reportes y en la lista de precios. En esta pantalla se configuran los tres niveles de forma encadenada. Cuando en Productos se elige la Marca, la lista de Líneas se filtra solo para esa marca. Cuando se elige la Línea, la lista de Grupos se filtra solo para esa línea.
________________________________________
Configuración → COBROS
Qué se requiere: El módulo de registro de pagos recibidos (cobros de ventas) debe soportar más tipos de instrumentos de cobro y validaciones adicionales.
Tipos de cobro a agregar:
•	Cheque al día
•	Cheque diferido (con fecha de acreditación)
•	Transferencia bancaria
•	Efectivo
•	Tarjeta
Campos adicionales requeridos:
•	Número de recibo: campo obligatorio. El sistema debe validar que no exista otro recibo con el mismo número — si ya existe, mostrar error antes de guardar.
•	Para cheques: número de cheque, banco emisor, fecha del cheque (para diferidos: fecha de cobro esperada).
•	Número de transacción para transferencias bancarias.
Lo que hay que hacer:
•	Ampliar el campo medio_pago en la tabla venta_pagos con los nuevos tipos.
•	Agregar campo numero_recibo con constraint de unicidad en la base de datos.
•	Agregar campos opcionales: numero_cheque, banco_emisor, fecha_cheque, numero_transaccion.
•	Implementar la validación de número de recibo duplicado antes de guardar.
________________________________________
Configuración → Condiciones de Venta
Para no tener que escribir el plazo a mano cada vez que se hace una venta o compra, el sistema debe tener configuradas las condiciones estándar. Por ejemplo: Contado (0 días, 1 cuota), 30 días crédito (30 días, 1 cuota), 60 días (60 días, 1 cuota), 3 cuotas a 30 días. Desde Clientes se le asigna a cada cliente su condición habitual, y esa condición se trae automáticamente al crear una venta.
________________________________________
Configuración → Vendedores y Porcentajes de Comisión
Teixeira paga comisiones a sus vendedores. La particularidad es que el porcentaje de comisión no es el mismo para todos los productos: cada producto puede tener su propio porcentaje. Y en una misma factura pueden convivir productos con porcentajes distintos.
Esta pantalla no es un módulo complejo con gestión de roles de acceso al sistema. Es una tabla simple donde el administrador registra los vendedores de la empresa con su nombre y datos de contacto. El porcentaje de comisión por producto se configura desde la pantalla de Productos, no aquí. Aquí solo se da de alta al vendedor como persona. Desde Clientes se le asigna a cada cliente cuál es su vendedor responsable.
________________________________________
BLOQUE 2 — PRODUCTOS
El menú lateral ya tiene la opción Productos. Esta pantalla existe y funciona. Se le agregan campos nuevos organizados por sección dentro del mismo formulario de alta y edición de productos.
________________________________________
Sección de identificación del producto
El formulario actual pide SKU, nombre, descripción, categoría, unidad de medida, y si está activo. Se agregan:
Clasificación: lista desplegable que trae los valores configurados en Configuración → Clasificación de Productos. Es obligatorio. Este campo es el más crítico porque todo el comportamiento del producto depende de él: si puede facturarse, si tiene stock, si necesita lote y vencimiento. Al seleccionarlo, el formulario ajusta automáticamente qué campos quedan habilitados o bloqueados.
Código de barras: campo de texto para ingresar el código EAN-13. Las facturas reales de Teixeira (imagen 2) usan el código de barras como código de artículo en la factura: 7840505124336, 7840505124176, 7840505124169, etc. La lista de precios (imagen 4) también lo usa como columna principal. El sistema debe permitir ingresar este código a mano o usando un lector de código de barras conectado. Este campo también sirve para buscar el producto rápidamente al hacer una venta o compra.
Código interno: número correlativo asignado por el sistema (imagen 4 muestra código 1000 y 1001). Se asigna automáticamente al crear el producto.
Marca, Línea, Grupo: tres listas desplegables encadenadas que traen datos de Configuración. Al elegir la Marca, la lista de Línea se filtra. Al elegir la Línea, la lista de Grupo se filtra.
________________________________________
Sección de impuestos
Tasa de IVA: lista desplegable que trae las tasas configuradas (Exento 0%, 5%, 10%). La factura de Teixeira confirma que sus edulcorantes están al 10%. Esta tasa se aplica automáticamente al incluir el producto en una factura para determinar en cuál columna (EXENTAS, 5%, 10%) se registra el importe.
Es producto de exportación: casilla de verificación (sí/no). Cuando está marcada, independientemente de la tasa de IVA asignada, el producto siempre se factura como exento cuando va a un cliente del exterior. Esto es un requisito fiscal de Paraguay para la facturación internacional que Teixeira realiza (la empresa tiene en su propia factura el texto "Import - Export" y "Facturas al Exterior" es un requerimiento explícito del relevamiento).
________________________________________
Sección de precios de venta
En lugar de un único campo "Precio de venta", el formulario muestra una grilla con todas las listas de precios activas configuradas en el sistema. Por cada lista aparece el nombre de la lista y un campo de precio editable.
Por ejemplo, para KADO MIX 30 ML aparecería: CONSUMO → 4.800 / DISTRIBUIDOR → 4.291 / GLORIA → 3.781 / PERSONAL TEIXEIRA → 3.500 / LICITACIÓN → (vacío) / BON GUSTO → (vacío) / DEL BOSQUE HORECA → (vacío) / DEL BOSQUE MINORISTA → (vacío). El precio se ingresa con IVA incluido. El sistema también muestra el precio sin IVA calculado automáticamente al lado.
Si la lista es en Dólares, el precio se ingresa en USD y el sistema muestra el equivalente en guaraníes según el tipo de cambio del día (ver más adelante en el apartado de ventas al exterior).
________________________________________
Sección de producción y stock
Plazo de vencimiento en meses: campo numérico, por defecto 36 (tres años). Este dato lo confirman las imágenes 2 y 3 de forma cruzada. En la planilla de producción (imagen 3) se ve que la fila N°1 tiene fecha de elaboración 04/05/26 y fecha de vencimiento 04/05/29 — exactamente tres años. La fila N°3 (KADO 100% STEVIA, lote LQ3562) elaborado 06/05/26 vence 06/05/28 — esos son dos años, lo que indica que el plazo puede variar según el producto. Por eso este campo debe ser configurable por producto, con 36 meses como valor sugerido. Al registrar una nueva producción, el sistema calcula automáticamente la fecha de vencimiento del lote sumando este plazo a la fecha de elaboración.
Control de lote: casilla de verificación, ya existe. El sistema debe respetar la regla derivada de la clasificación: si el producto es Insumo, el lote es obligatorio pero la fecha de vencimiento no. Si es Mercadería, ambos son obligatorios.
________________________________________
Sección de comisiones
Porcentaje de comisión: campo numérico con decimales (por ejemplo 5.00, o 3.50). Este porcentaje es propio de cada producto y puede ser diferente entre un producto y otro. Es el porcentaje que se aplica sobre el precio sin IVA de ese artículo para calcular cuánto le corresponde al vendedor cada vez que aparece en una factura. Si el campo queda en cero, ese producto no genera comisión.
________________________________________
BLOQUE 3 — CLIENTES
El menú lateral ya tiene la opción Clientes. Esta pantalla existe. Se ajustan campos existentes y se agregan nuevos.
________________________________________
El campo Tipo de documento actualmente ofrece DNI, CUIT, RUC y OTRO. Para Teixeira la opción principal es RUC (Paraguay). El sistema además debe validar el formato del RUC paraguayo cuando se ingresa: es una secuencia de entre 6 y 8 dígitos seguida de un guion y un dígito verificador. El dato real es visible en la factura (imagen 2): el cliente Gloria tiene RUC 80002010-3. La propia empresa tiene RUC 80046906-2 (visible en todas las imágenes). Actualmente el sistema valida el CUIT argentino, esa validación debe reemplazarse por la del RUC paraguayo.
El campo Límite de crédito existe pero actualmente el sistema lo usa para bloquear ventas cuando el cliente lo supera. Esta restricción se elimina. El campo queda como dato informativo visible en la ficha del cliente y en el formulario de nueva venta, pero el sistema no impide registrar la venta si se supera el límite. Solo muestra un aviso visual de color amarillo.
Se agregan los siguientes campos nuevos:
Lista de precios asignada: lista desplegable que trae los nombres configurados en Configuración → Listas de Precios. Al seleccionar esta lista en la ficha del cliente, cuando ese cliente sea elegido en una factura de venta, el sistema carga automáticamente los precios de esa lista para cada producto. El cliente Gloria S.A.C.E.I. por ejemplo tendría asignada la lista "GLORIA" y al facturarle traería los precios de esa columna.
Vendedor asignado: lista desplegable con los vendedores cargados en Configuración → Vendedores. Al emitir una factura para este cliente, el sistema sabe automáticamente a quién calcular la comisión, sin tener que elegirlo en cada venta.
Condición de venta habitual: lista desplegable que trae las condiciones configuradas en Configuración → Condiciones de Venta. Se usa como valor sugerido al crear una nueva venta para este cliente, evitando tener que seleccionarlo cada vez.
¿Cliente del exterior?: casilla de verificación. Si está marcada, todas las facturas emitidas a este cliente se tratan como exentas de IVA para la columna EXENTAS de la factura, independientemente de la tasa de IVA de cada producto.
________________________________________
BLOQUE 4 — PROVEEDORES
El menú lateral ya tiene Proveedores. Esta pantalla existe y no requiere cambios estructurales mayores. Solo se agrega el campo RUC con la misma validación de formato que en Clientes, y el campo Condición de pago habitual que trae las condiciones configuradas en Configuración → Condiciones de Venta.
________________________________________
BLOQUE 5 — PRODUCCIÓN
El menú lateral ya tiene Producción. Esta pantalla existe. La planilla física de la empresa (imagen 3) muestra exactamente cómo trabajan: el formulario FP-07-01 Rev.05 registra fecha de elaboración, fecha de vencimiento, número de lote y las cantidades producidas de cada presentación en una tabla con columnas por tipo de producto y sub-columnas por tamaño de envase.
Los ajustes necesarios son los siguientes:
Todo el texto que el usuario escribe en el formulario de Producción debe guardarse automáticamente en mayúsculas. El número de lote (LQ3560, LQ3561, etc.), las descripciones, las observaciones. Esto debe ocurrir sin que el usuario tenga que activar Bloq Mayús: el campo convierte el texto solo al escribir.
Al agregar un producto a la producción, el sistema calcula automáticamente la fecha de vencimiento sumando el plazo configurado en ese producto (en meses) a la fecha de elaboración del lote. El campo queda editable por si el operador necesita corregirlo.
El sistema debe filtrar la lista de productos disponibles como insumos de producción: solo deben aparecer los clasificados como Materia Prima o Insumo. La Mercadería y los Servicios no pueden usarse como insumo de producción.
El sistema debe filtrar la lista de productos disponibles como items producidos (lo que sale de la producción): solo deben aparecer los clasificados como Mercadería.
Cuando se elige un insumo que es de clasificación Insumo (frasco, tapa, etiqueta), el campo de número de lote es requerido pero el campo de fecha de vencimiento queda oculto o deshabilitado, porque los insumos no tienen vencimiento.
________________________________________
 
BLOQUE 6 — COMPRAS
El menú lateral ya tiene Compras. Esta pantalla existe. Los ajustes son:
En el encabezado de una compra, cuando la condición de pago es Crédito, el sistema habilita los campos de plazo en días y cantidad de cuotas. Al confirmar la compra, genera automáticamente la tabla de cuotas con sus fechas de vencimiento y montos. La primera cuota vence a los N días desde la fecha de la compra, la segunda al doble, y así sucesivamente.
En el detalle de cada ítem de compra, cuando el producto tiene control de lote activo, el campo Número de lote es obligatorio. El campo de Fecha de vencimiento es obligatorio solo si el producto es Mercadería; si es Insumo, no aparece.
El campo de Precio unitario en compras se ingresa con IVA incluido. El sistema muestra al lado el precio sin IVA calculado automáticamente. También muestra el porcentaje de IVA tomado del producto, editable por si el proveedor factura con una tasa diferente a la habitual del artículo.
Al seleccionar un producto en una línea de compra, el sistema muestra debajo del precio un historial con los últimos cinco precios de compra de ese artículo a cualquier proveedor, con la fecha de cada compra. Esto permite al operador comparar si el precio actual es razonable respecto al histórico. El campo de precio trae precargado el último precio registrado.
Se agrega el campo Costo de flete en el encabezado de la compra (no por ítem). Es un monto adicional que se suma al costo total de la compra. El sistema distribuye este flete proporcionalmente entre los ítems según su valor para calcular el costo real de adquisición de cada artículo, aunque el registro principal del flete queda en la cabecera.
________________________________________
BLOQUE 7 — VENTAS Y FACTURACIÓN
El menú lateral ya tiene Ventas. Esta es la pantalla más crítica y la que más cambios requiere para que el sistema genere una factura que sea fiel al documento físico real de Teixeira.
________________________________________
Encabezado de la factura
La factura física (imágenes 1 y 2) tiene un encabezado con datos fijos de la empresa (nombre, dirección, teléfono, RUC, actividad comercial) y datos variables por factura. El sistema debe reproducir esto exactamente.
Los datos fijos del encabezado (nombre de la empresa, dirección, teléfonos, RUC, actividad, Timbrado, punto de expedición) se configuran una sola vez en la configuración general del sistema. El Timbrado N° 18781301 con vigencia desde 10/04/2026 hasta 30/04/2027 y la numeración 001-001 son los datos reales de Teixeira visibles en ambas facturas (imágenes 1 y 2).
El formulario de nueva venta se ajusta para incluir:
Cliente: ya existe. Al seleccionarlo trae automáticamente su RUC, dirección, condición de venta habitual y lista de precios asignada.
Fecha de la factura: ya existe, por defecto hoy.
Nota de remisión N°: campo de texto. La factura física lo tiene como campo visible en el encabezado. Puede quedar vacío si no hay remisión asociada.
Condición de venta: Contado o Crédito, con el valor sugerido tomado del cliente. La factura física (imagen 2) muestra la palabra "CONTADO" marcada pero también tiene una "F.V. 25/07/2026" que es la fecha de vencimiento de la factura. Esto significa que incluso facturas marcadas como crédito pueden tener esa fecha. El sistema debe calcularla automáticamente: fecha de emisión de la factura más el plazo en días de la condición de venta.
________________________________________
Regla central de facturación: qué productos pueden facturarse
Solo los productos con clasificación Mercadería o Servicio pueden agregarse a una factura de venta al cliente. Si el usuario intenta agregar un producto de Materia Prima o Insumo, el sistema no lo permite y muestra un aviso explicando que ese tipo de producto no se factura. Esta es la regla más importante de todo el módulo de ventas.
________________________________________
Detalle de ítems en la factura
La factura real (imagen 2) tiene en la columna de descripción los datos del producto integrados en una sola línea así: "EDUL KADO STEVIA Y SUCRALOSA 250 ML" seguido del número de lote "LQ3548" y la fecha de vencimiento "13/04/2029". En el sistema estos tres datos son campos separados que al imprimir el PDF se muestran juntos en la descripción.
Cada ítem de la factura tiene:
Código/artículo: el sistema busca el producto por código de barras (si hay lector conectado) o por nombre escribiendo en el campo. Al encontrarlo trae automáticamente la descripción, la tasa de IVA y el precio según la lista asignada al cliente.
Cantidad: campo numérico.
Descripción: trae el nombre del producto, editable si el usuario necesita modificarla.
Número de lote: lista desplegable con los lotes activos de ese producto, ordenados de manera que el primero que aparece es el que vence antes (criterio FEFO, que ya existe en el sistema y funciona correctamente). El operador puede cambiar el lote si lo necesita.
Fecha de vencimiento del lote: se completa sola al elegir el lote. No se edita directamente aquí.
Precio unitario: trae el precio de la lista asignada al cliente para ese producto.
Columna EXENTAS: el sistema calcula y registra el monto aquí si la tasa de IVA del producto es 0%, o si el cliente está marcado como exterior, o si el producto tiene marcado el check de exportación.
Columna 5%: el sistema registra el monto aquí si la tasa del producto es 5%.
Columna 10%: el sistema registra el monto aquí si la tasa del producto es 10%. En la factura de ejemplo (imagen 2) todos los ítems están en esta columna.
________________________________________
Pie de la factura
Siguiendo exactamente el formato del documento físico (imágenes 1 y 2):
•	Valor parcial: suma de todos los ítems antes de calcular IVA
•	Total a pagar en Guaraníes / USD: con un checkbox para indicar la moneda. Cuando es en USD, el sistema convierte el total al tipo de cambio del día (ingresado manualmente por el administrador cada mañana desde Configuración)
•	Liquidación del IVA 5%: monto de IVA calculado sobre los ítems en columna 5%
•	Liquidación del IVA 10%: monto de IVA calculado sobre los ítems en columna 10%
•	Total IVA: suma de ambos
•	Total general: valor parcial más total IVA
________________________________________
Anulación de facturas
En el detalle de una factura ya emitida, el botón "Anular" abre un formulario que pide obligatoriamente el motivo de la anulación. Al confirmar, el sistema revierte el movimiento de stock de cada ítem al lote correspondiente (devuelve las unidades), marca la factura como ANULADA con el motivo y la fecha de anulación. La factura no se borra, queda en el historial con su número y estado ANULADO visible. Si la empresa trabaja con facturación electrónica SIFEN, la anulación también deberá enviarse a la SET (esto se contempla en el bloque de SIFEN al final de este documento).
________________________________________
BLOQUE 8 — COBROS
Hoy los cobros se registran dentro del detalle de una venta con un botón sencillo. Esto es insuficiente para la operación real de Teixeira. El Recibo de Dinero N° 0002993 (imagen 5) muestra que los cobros son documentos complejos: un solo recibo cancela múltiples facturas a la vez, descuenta retenciones y puede combinar varios medios de pago simultáneamente.
Se crea una pantalla nueva en el menú lateral llamada Cobros, accesible desde el menú entre Ventas y Clientes.
________________________________________
Lista de cobros
La pantalla principal muestra todos los recibos emitidos con número de recibo, fecha, cliente, total cobrado y estado. Tiene buscador por número o por cliente. Botón "Nuevo cobro".
________________________________________

Formulario de nuevo cobro
El formulario reproduce la estructura del recibo físico de la empresa (imagen 5).
Encabezado del recibo:
Número de recibo: el sistema sugiere el siguiente número correlativo (en la imagen 5 el recibo es N° 0002993). El usuario puede modificarlo pero el sistema valida que no exista otro recibo con ese mismo número antes de guardar. Si existe, muestra error y no guarda.
Fecha: por defecto hoy, editable.
Cliente: lista desplegable. Al seleccionarlo aparecen su RUC y dirección.
Concepto: texto libre (en la imagen 5 dice "Cancelación de Facturas").
Sección de facturas que se cancelan:
Una grilla donde el operador agrega las facturas que este cobro cancela. El recibo de imagen 5 cancela la factura 11824 por Gs. 10.616.748 y la factura 11848 por Gs. 11.542.368. Se puede escribir el número de factura o buscarlo desde las facturas pendientes del cliente. Cada fila tiene el número de factura y el importe que se aplica a esa factura con ese cobro.
Sección de retenciones:
Las retenciones son descuentos fiscales que los clientes grandes (como supermercados o empresas formales) practican al pagar. En el recibo físico (imagen 5) aparecen: Ret. 7366 por (Gs. 289.548) y Ret. 7367 por (Gs. 314.792). Son montos negativos que se descuentan del total. La grilla de retenciones tiene número de retención y monto (siempre negativo). El sistema suma el total de facturas y resta el total de retenciones para calcular el neto a recibir.
Sección de medios de pago:
El recibo real (imagen 5) muestra tres cheques del Banco Familiar y una transferencia todo en el mismo cobro. El formulario debe permitir combinar libremente:
Efectivo: casilla de verificación + campo de monto.
Transferencia bancaria: casilla + monto + número de transacción + banco (lista de Configuración → Bancos).
Cheque al día: casilla + monto + número de cheque + banco + fecha del cheque.
Cheque diferido: casilla + monto + número de cheque + banco + fecha en que se cobra (fecha futura).
El usuario puede agregar tantas filas de cheques como necesite. En el ejemplo de imagen 5 hay tres cheques del mismo banco, cada uno con su propio número y monto de Gs. 7.184.925.
El sistema suma todos los medios de pago y los compara con el total neto (facturas menos retenciones). Si no coinciden, muestra un aviso de diferencia antes de permitir guardar. No bloquea, solo avisa, por si hay diferencias de centavos por redondeos.
Al guardar el recibo, el sistema actualiza automáticamente el saldo pendiente de cada factura incluida y el saldo pendiente del cliente.
________________________________________
BLOQUE 9 — PAGOS A PROVEEDORES
Hoy los pagos a proveedores se registran desde la pantalla de Compras. Se mejora este formulario con la misma estructura que Cobros para mantener consistencia.
El pago a un proveedor puede incluir múltiples facturas de compra, puede tener retenciones que Teixeira practica al proveedor, y puede pagarse con múltiples medios (cheques, transferencias, efectivo). El formulario de pago a proveedor queda estructurado exactamente igual al de cobros pero en sentido inverso: en lugar de recibir dinero, se paga.
Se agrega el campo Número de transacción en todos los pagos por transferencia, tanto en cobros como en pagos a proveedores.
El número de recibo de pago también tiene validación de duplicidad: el sistema avisa si ya existe un recibo con el mismo número antes de guardar.
________________________________________
BLOQUE 10 — GASTOS
El menú lateral ya tiene Gastos. Se agregan dos campos:
Condición: lista desplegable con dos opciones, Débito (el gasto ya se pagó) o Crédito (el gasto quedó pendiente de pago). Actualmente el módulo solo registra gastos ya pagados.
Fecha de vencimiento: campo de fecha que aparece habilitado solo cuando la condición es Crédito. Indica cuándo vence el pago de ese gasto. Esto permite al sistema incluir los gastos pendientes en el reporte de vencimientos del Dashboard junto con las facturas de venta a crédito.
________________________________________
BLOQUE 11 — COMISIONES
No es una pantalla de gestión de usuarios con roles de acceso. Es una sección de consulta y reporte, accesible desde el menú lateral entre Gastos y Producción, llamada Comisiones.
________________________________________
Cómo funciona el cálculo
Cada vez que se emite una factura de venta confirmada, el sistema calcula automáticamente la comisión por cada ítem de esa factura. La lógica es: precio unitario sin IVA del ítem, multiplicado por la cantidad vendida, multiplicado por el porcentaje de comisión configurado en ese producto. El resultado es el monto de comisión que le corresponde al vendedor asignado al cliente de esa factura.
En una misma factura puede haber productos con porcentajes diferentes. Por ejemplo, la factura 0011978 (imagen 2) incluye KADO MIX 100 ML (que podría tener 5% de comisión) y KADO 100% STEVIA 100ML (que podría tener 3% de comisión). El sistema calcula y registra cada una por separado, vinculadas al mismo número de factura.
________________________________________
Pantalla de Comisiones
Muestra una tabla con todos los registros de comisión: vendedor, cliente, número de factura, fecha, producto, precio sin IVA, cantidad, porcentaje aplicado, monto de comisión y estado (pendiente de pagar / pagada).
Tiene filtros por vendedor, por rango de fechas y por estado.
Tiene un botón para marcar comisiones como pagadas, seleccionando varias a la vez (por ejemplo, todas las del mes para un vendedor).
El reporte de comisiones muestra el resumen por vendedor: cuántas facturas, cuántos productos, total de comisiones pendientes y total ya liquidado. Este reporte es el que el administrativo usa para saber cuánto pagarle a cada vendedor al cierre del mes.
________________________________________
BLOQUE 12 — REPORTES
El menú lateral ya tiene Reportes. Esta pantalla existe con cuatro reportes (Ventas, Stock, Cuentas a Cobrar, Vencimientos de Lotes). Se agregan:
Reporte de comisiones por vendedor: por período, con detalle por factura y producto. Exportable a Excel.
Reporte de cuentas a pagar (proveedores): lista de facturas de compra pendientes de pago ordenadas por fecha de vencimiento. Hoy solo existe el reporte de cuentas a cobrar de clientes.
Reporte de gastos pendientes: facturas de gastos con condición Crédito y fecha de vencimiento próxima.
Reporte de facturas por lista de precios: permite ver qué clientes se facturan con cada lista, útil para verificar que ningún cliente quedó mal asignado.
________________________________________
BLOQUE 13 — FACTURACIÓN ELECTRÓNICA (SIFEN / SET)
Este es un bloque de planificación técnica que no se implementa en la primera versión del sistema pero cuya estructura debe contemplarse desde el inicio para no tener que rehacer todo después.
Teixeira S.A. está obligada o en proceso de incorporarse al sistema de Facturación Electrónica de Paraguay (SIFEN), administrado por la Subsecretaría de Estado de Tributación (SET) del DNIT. Sus facturas actuales (imágenes 1 y 2) ya tienen los elementos del sistema físico: Timbrado, punto de expedición, numeración correlativa.
La transición a facturas electrónicas implica que cada factura emitida debe enviarse en formato XML firmado digitalmente al sistema de la SET, que devuelve un código CDC (Código de Control del Documento) que valida la factura. Las facturas al exterior tienen un tratamiento específico como "Documento Tributario Electrónico de Exportación".
Lo que el sistema debe tener preparado desde ahora:
En la Configuración general, campos para: Timbrado vigente, fecha de inicio y fin de vigencia, punto de expedición, tipo de contribuyente, número de establecimiento. Estos datos ya son visibles en las facturas físicas (imagen 1: Timbrado 18781301, Fecha inicio 10/04/2026, Fecha fin 30/04/2027, RUC 80046906-2).
Cada factura debe guardar en la base de datos el campo CDC (código devuelto por la SET) y el estado de envío electrónico (no enviado, enviado pendiente, aprobado, rechazado, anulado). Al principio estos campos quedan vacíos porque la integración no está activa. Cuando se implemente la conexión con la SET, el sistema los completará automáticamente.
El módulo de anulación de facturas debe contemplar el flujo de anulación electrónica ante la SET, que es un proceso separado al de la anulación interna en el sistema.
________________________________________
RESUMEN EJECUTIVO DE CAMBIOS
Para que cliente y desarrollador tengan una vista rápida del alcance completo:
Pantallas nuevas a crear: Configuración (con sus sub-secciones: Unidades de Medida, Clasificación de Productos, Tasas de IVA, Listas de Precios, Marcas/Líneas/Grupos, Bancos, Condiciones de Venta, Vendedores), Cobros, Comisiones.
Pantallas existentes con ajustes: Productos (campos de clasificación, IVA, exportación, código de barras, marca/línea/grupo, precios por lista, plazo de vencimiento, porcentaje de comisión), Clientes (RUC validado, lista de precios asignada, vendedor asignado, condición de venta, cliente exterior, límite de crédito sin bloqueo), Proveedores (RUC validado, condición de pago), Ventas/Nueva Venta (encabezado completo según factura física, regla de clasificación, columnas EXENTAS/5%/10%, anulación), Compras (historial de precios, IVA en compras, lote y vencimiento por clasificación, costo de flete, cuotas en crédito), Gastos (condición débito/crédito, fecha de vencimiento), Producción (mayúsculas automáticas, filtro por clasificación, cálculo automático de vencimiento por plazo), Reportes (tres reportes nuevos).
Prioridad de implementación sugerida: Primero las pantallas de Configuración, porque todo lo demás depende de ellas. Segundo, los ajustes a Productos y Clientes. Tercero, los cambios en Ventas y Facturación, que son el corazón de la operación diaria. Cuarto, Cobros como pantalla nueva. Quinto, los ajustes a Compras, Gastos y Producción. Sexto, Comisiones y los nuevos Reportes. La integración SIFEN va en una fase separada posterior.
________________________________________
** 2-Lote y vencimiento es obligatorio para materia prima, no mercaderías. y si puede generar un vencimiento generico en caso que no tenga lote o vencimiento
 
