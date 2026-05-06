'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, calcularCuotas, formatDate } from '@/lib/utils';
import { Plus, Trash2, ShoppingCart, Loader2, ArrowLeft, Search, Printer, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Cliente, Producto, Lote, NuevaVentaItem } from '@/lib/types';

export default function NuevaVentaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [items, setItems] = useState<NuevaVentaItem[]>([]);
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado');
  const [plazoDias, setPlazoDias] = useState(30);
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [descuento, setDescuento] = useState(0);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [puntoVenta, setPuntoVenta] = useState('');
  const [notas, setNotas] = useState('');
  const [timbrado, setTimbrado] = useState('');
  const [ventaConfirmada, setVentaConfirmada] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [buscarProducto, setBuscarProducto] = useState('');
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [mostrarBuscador, setMostrarBuscador] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [clientesRes, productosRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos')
        .select('*, lotes(id, numero_lote, fecha_vencimiento, stock_actual)')
        .eq('activo', true)
        .gt('stock_actual', 0)
        .order('nombre'),
    ]);
    setClientes(clientesRes.data as Cliente[] || []);
    const prods = (productosRes.data || []) as Producto[];
    // Ordenar lotes por FEFO (fecha vencimiento más próxima primero)
    prods.forEach(p => {
      if (p.lotes) {
        p.lotes = p.lotes
          .filter(l => l.stock_actual > 0)
          .sort((a, b) => {
            if (!a.fecha_vencimiento) return 1;
            if (!b.fecha_vencimiento) return -1;
            return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
          });
      }
    });
    setProductos(prods);
  }

  function handleClienteChange(id: string) {
    setClienteId(id);
    setClienteSeleccionado(clientes.find(c => c.id === id) || null);
  }

  function buscarProductos(term: string) {
    setBuscarProducto(term);
    if (!term) {
      setProductosFiltrados(productos.slice(0, 12));
      return;
    }
    setProductosFiltrados(
      productos.filter(p =>
        p.nombre.toLowerCase().includes(term.toLowerCase()) ||
        p.sku.toLowerCase().includes(term.toLowerCase())
      ).slice(0, 12)
    );
  }

  function agregarProducto(producto: Producto) {
    const loteFefo = producto.lotes?.[0];
    const nuevo: NuevaVentaItem = {
      producto_id: producto.id,
      producto_nombre: `${producto.sku} - ${producto.nombre}`,
      lote_id: loteFefo?.id,
      numero_lote: loteFefo?.numero_lote,
      fecha_vencimiento: loteFefo?.fecha_vencimiento,
      cantidad: 1,
      precio_unitario: producto.precio_venta,
      subtotal: producto.precio_venta,
      lotes_disponibles: producto.lotes,
    };
    setItems(prev => [...prev, nuevo]);
    setBuscarProducto('');
    setProductosFiltrados([]);
    setMostrarBuscador(false);
  }

  function actualizarItem(idx: number, campo: string, valor: string | number) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [campo]: valor };
      if (campo === 'lote_id') {
        const lote = item.lotes_disponibles?.find(l => l.id === valor);
        item.numero_lote = lote?.numero_lote;
        item.fecha_vencimiento = lote?.fecha_vencimiento;
      }
      if (campo === 'cantidad' || campo === 'precio_unitario') {
        item.subtotal = (parseFloat(String(item.cantidad)) || 0) * (parseFloat(String(item.precio_unitario)) || 0);
      }
      updated[idx] = item;
      return updated;
    });
  }

  function eliminarItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const subtotalBruto = items.reduce((s, i) => s + (i.subtotal || 0), 0);
  const total = Math.max(0, subtotalBruto - descuento);
  const cuotasPreview = condicionPago === 'credito' && cantidadCuotas > 0 && total > 0
    ? calcularCuotas(total, cantidadCuotas, plazoDias)
    : [];

  const creditoDisponible = clienteSeleccionado
    ? clienteSeleccionado.limite_credito - clienteSeleccionado.saldo_pendiente
    : 0;

  async function confirmarVenta() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return; }
    if (condicionPago === 'credito' && total > creditoDisponible) {
      toast.error(`El cliente no tiene crédito suficiente. Disponible: ${formatCurrency(creditoDisponible)}`);
      return;
    }
    // Validar stock
    for (const item of items) {
      const prod = productos.find(p => p.id === item.producto_id);
      if (prod && item.cantidad > prod.stock_actual) {
        toast.error(`Stock insuficiente para ${prod.nombre}. Disponible: ${prod.stock_actual}`);
        return;
      }
      if (item.lote_id && prod?.lotes) {
        const lote = prod.lotes.find(l => l.id === item.lote_id);
        if (lote && item.cantidad > lote.stock_actual) {
          toast.error(`Stock insuficiente en lote ${lote.numero_lote}. Disponible: ${lote.stock_actual}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Generar número de venta
      const { count } = await supabase.from('ventas').select('*', { count: 'exact', head: true });
      const numVenta = `V-${String((count || 0) + 1).padStart(5, '0')}`;

      // Crear venta
      const { data: venta, error: ventaErr } = await supabase.from('ventas').insert({
        numero: numVenta,
        fecha: new Date().toISOString(),
        cliente_id: clienteId,
        condicion_pago: condicionPago,
        plazo_dias: condicionPago === 'credito' ? plazoDias : null,
        cantidad_cuotas: condicionPago === 'credito' ? cantidadCuotas : 1,
        subtotal: subtotalBruto,
        descuento: descuento,
        total,
        saldo_pendiente: condicionPago === 'credito' ? total : 0,
        estado: condicionPago === 'contado' ? 'pagado' : 'pendiente',
        numero_factura: numeroFactura || null,
        punto_venta: puntoVenta || null,
        notas: notas || null,
      }).select().single();

      if (ventaErr) throw ventaErr;

      // Crear items
      const ventaItemsData = items.map(item => ({
        venta_id: venta.id,
        producto_id: item.producto_id,
        lote_id: item.lote_id || null,
        numero_lote: item.numero_lote || null,
        fecha_vencimiento: item.fecha_vencimiento || null,
        descripcion: item.producto_nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
      }));
      await supabase.from('venta_items').insert(ventaItemsData);

      // Crear cuotas si es crédito
      if (condicionPago === 'credito' && cuotasPreview.length > 0) {
        const cuotasData = cuotasPreview.map(c => ({
          venta_id: venta.id,
          numero_cuota: c.numero,
          fecha_vencimiento: c.fecha_vencimiento,
          monto: c.monto,
          monto_pagado: 0,
          estado: 'pendiente',
        }));
        await supabase.from('venta_cuotas').insert(cuotasData);
      }

      // Actualizar stock por producto y lote
      for (const item of items) {
        // Producto
        const prod = productos.find(p => p.id === item.producto_id);
        if (prod) {
          await supabase.from('productos').update({ stock_actual: prod.stock_actual - item.cantidad }).eq('id', item.producto_id);
        }
        // Lote
        if (item.lote_id && prod?.lotes) {
          const lote = prod.lotes.find(l => l.id === item.lote_id);
          if (lote) {
            await supabase.from('lotes').update({ stock_actual: lote.stock_actual - item.cantidad }).eq('id', item.lote_id);
          }
        }
        // Movimiento de stock
        await supabase.from('movimientos_stock').insert({
          producto_id: item.producto_id,
          lote_id: item.lote_id || null,
          tipo: 'salida',
          cantidad: -item.cantidad,
          referencia_tipo: 'venta',
          referencia_id: venta.id,
        });
      }

      // Actualizar saldo del cliente si es crédito
      if (condicionPago === 'credito') {
        await supabase.from('clientes').update({
          saldo_pendiente: (clienteSeleccionado?.saldo_pendiente || 0) + total
        }).eq('id', clienteId);
      }

      toast.success(`✅ Venta ${numVenta} registrada exitosamente`);
      setVentaConfirmada(numVenta);
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setClienteId('');
    setClienteSeleccionado(null);
    setItems([]);
    setCondicionPago('contado');
    setPlazoDias(30);
    setCantidadCuotas(1);
    setDescuento(0);
    setNumeroFactura('');
    setPuntoVenta('');
    setTimbrado('');
    setNotas('');
    setVentaConfirmada(null);
    setBuscarProducto('');
    setProductosFiltrados([]);
  }

  function imprimirDocumento(ventaNum: string) {
    const tieneFactura = !!numeroFactura;
    const fecha = new Date().toLocaleDateString('es-PY');
    const hora = new Date().toLocaleTimeString('es-PY');

    const itemsHtml = items.map(item =>
      '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee">' + item.producto_nombre + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">' + item.cantidad + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">' + formatCurrency(item.precio_unitario) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">' + formatCurrency(item.subtotal) + '</td>' +
      '</tr>'
    ).join('');

    let html: string;

    if (tieneFactura) {
      const nroFactura = (puntoVenta || '001') + '-' + numeroFactura;
      const clienteNombre = clienteSeleccionado?.nombre || '—';
      const clienteDoc = clienteSeleccionado?.documento || '—';
      const condStr = condicionPago === 'contado' ? 'Contado' : 'Crédito (' + plazoDias + ' días)';
      const descuentoHtml = descuento > 0
        ? '<tr><td style="padding:3px 8px">Descuento:</td><td style="padding:3px 8px;text-align:right">- ' + formatCurrency(descuento) + '</td></tr>'
        : '';
      const notasHtml = notas
        ? '<div style="margin-top:15px;font-size:11px;color:#555;border-top:1px dashed #ccc;padding-top:8px"><strong>Observaciones:</strong> ' + notas + '</div>'
        : '';

      html =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Factura ' + ventaNum + '</title>' +
        '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000}' +
        'table.items{width:100%;border-collapse:collapse}table.items th{background:#333;color:#fff;padding:7px 8px;font-size:11px;text-align:left}' +
        '.firmas{display:flex;justify-content:space-around;margin-top:60px;text-align:center}' +
        '.firma-line{border-top:1px solid #000;padding-top:6px;min-width:150px;font-size:11px}' +
        '@media print{@page{margin:10mm;size:A4}}</style></head><body>' +
        '<div style="text-align:center;margin-bottom:20px">' +
        '<div style="font-size:20px;font-weight:bold">EDULCORANTES S.A.</div>' +
        '<div style="font-size:11px;color:#333;margin-top:4px">RUC: 80012345-6 &nbsp;|&nbsp; Tel: (021) 000-000 &nbsp;|&nbsp; Asunción, Paraguay</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">' +
        '<div>' +
        '<div style="font-size:11px;color:#555">Fecha de emisión:</div>' +
        '<div style="font-size:13px;font-weight:bold">' + fecha + ' ' + hora + '</div>' +
        '<div style="margin-top:8px;font-size:11px;color:#555">N° operación:</div>' +
        '<div style="font-weight:bold">' + ventaNum + '</div></div>' +
        '<div style="border:2px solid #000;padding:12px 20px;text-align:center">' +
        '<div style="font-size:14px;font-weight:bold;letter-spacing:2px">FACTURA</div>' +
        '<div style="font-size:18px;font-weight:bold;margin:5px 0">' + nroFactura + '</div>' +
        '<div style="font-size:10px">Timbrado N°: <strong>' + (timbrado || '——') + '</strong></div>' +
        '</div></div>' +
        '<div style="background:#f9f9f9;border:1px solid #ddd;padding:10px 15px;margin-bottom:15px">' +
        '<table style="width:100%">' +
        '<tr><td style="font-weight:bold;width:120px;padding:3px 6px">Cliente:</td><td style="padding:3px 6px">' + clienteNombre + '</td></tr>' +
        '<tr><td style="font-weight:bold;padding:3px 6px">RUC/CI:</td><td style="padding:3px 6px">' + clienteDoc + '</td></tr>' +
        '<tr><td style="font-weight:bold;padding:3px 6px">Condición:</td><td style="padding:3px 6px">' + condStr + '</td></tr>' +
        '</table></div>' +
        '<table class="items"><thead><tr>' +
        '<th>Descripción</th>' +
        '<th style="width:70px;text-align:center">Cant.</th>' +
        '<th style="width:130px;text-align:right">P. Unitario</th>' +
        '<th style="width:140px;text-align:right">Subtotal</th>' +
        '</tr></thead><tbody>' + itemsHtml + '</tbody></table>' +
        '<div style="text-align:right;margin-top:10px"><table style="margin-left:auto">' +
        '<tr><td style="padding:3px 8px">Subtotal:</td><td style="padding:3px 8px;text-align:right;min-width:140px">' + formatCurrency(subtotalBruto) + '</td></tr>' +
        descuentoHtml +
        '<tr><td style="padding:6px 8px;font-size:15px;font-weight:bold;border-top:2px solid #000">TOTAL:</td>' +
        '<td style="padding:6px 8px;text-align:right;font-size:15px;font-weight:bold;border-top:2px solid #000">' + formatCurrency(total) + '</td></tr>' +
        '</table></div>' +
        notasHtml +
        '<div class="firmas"><div class="firma-line">Vendedor</div><div class="firma-line">Recibí conforme</div></div>' +
        '</body></html>';

    } else {
      const clienteHtml = clienteSeleccionado
        ? '<div style="display:flex;justify-content:space-between;margin:2px 0"><span>Cliente:</span><span>' + clienteSeleccionado.nombre + '</span></div>'
        : '<div style="text-align:center;font-size:10px">Consumidor final</div>';
      const descuentoHtml = descuento > 0
        ? '<div style="display:flex;justify-content:space-between;margin:2px 0"><span>Descuento:</span><span>- ' + formatCurrency(descuento) + '</span></div>'
        : '';
      const ticketItems = items.map(item =>
        '<div style="margin:4px 0">' +
        '<div style="font-weight:bold;font-size:11px">' + (item.producto_nombre.split(' - ').slice(1).join(' - ') || item.producto_nombre) + '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px">' +
        '<span>' + item.cantidad + ' x ' + formatCurrency(item.precio_unitario) + '</span>' +
        '<span style="font-weight:bold">' + formatCurrency(item.subtotal) + '</span>' +
        '</div></div>'
      ).join('');

      html =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ' + ventaNum + '</title>' +
        '<style>*{margin:0;padding:0;box-sizing:border-box}' +
        'body{font-family:monospace;font-size:12px;width:300px;padding:10px;color:#000}' +
        '.line{border-top:1px dashed #000;margin:6px 0}' +
        '@media print{@page{margin:0;size:80mm auto}}</style></head><body>' +
        '<div style="text-align:center;font-size:14px;font-weight:bold">EDULCORANTES S.A.</div>' +
        '<div style="text-align:center;font-size:10px">RUC: 80012345-6</div>' +
        '<div style="text-align:center;font-size:10px">Asunción, Paraguay</div>' +
        '<div class="line"></div>' +
        '<div style="text-align:center;font-weight:bold">TICKET DE VENTA</div>' +
        '<div style="text-align:center;font-size:10px">' + ventaNum + '</div>' +
        '<div style="text-align:center;font-size:10px">' + fecha + ' ' + hora + '</div>' +
        '<div class="line"></div>' +
        clienteHtml +
        '<div class="line"></div>' +
        ticketItems +
        '<div class="line"></div>' +
        descuentoHtml +
        '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px">' +
        '<span>TOTAL:</span><span>' + formatCurrency(total) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px">' +
        '<span>Condición:</span><span>' + (condicionPago === 'contado' ? 'Contado' : 'Crédito') + '</span></div>' +
        '<div class="line"></div>' +
        '<div style="text-align:center;font-size:10px;margin-top:6px">¡Gracias por su compra!</div>' +
        '</body></html>';
    }

    const w = window.open('', '_blank', 'width=700,height=900');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 500);
    }
  }

  if (ventaConfirmada) {
    return (
      <>
        <Header title="Venta registrada" subtitle="La venta fue confirmada exitosamente" />
        <div className="p-6 max-w-2xl mx-auto">
          <div className="card p-10 text-center space-y-6">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-emerald-600">¡Venta confirmada!</h2>
              <p className="text-gray-500 mt-1">N° de venta: <strong className="text-gray-800 dark:text-gray-100">{ventaConfirmada}</strong></p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={() => imprimirDocumento(ventaConfirmada)}
                className="btn-primary flex items-center justify-center gap-2 py-3 px-8"
              >
                <Printer className="w-5 h-5" />
                {numeroFactura ? 'Imprimir Factura' : 'Imprimir Ticket'}
              </button>
              <button
                onClick={resetForm}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-8 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nueva venta
              </button>
              <Link
                href="/dashboard/ventas"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-8 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Ir a ventas
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Nueva Venta" subtitle="Registrar venta al contado o a crédito" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Link href="/dashboard/ventas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Volver a ventas
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cliente */}
            <div className="card p-5">
              <h2 className="section-title mb-4">Cliente</h2>
              <select className="input" value={clienteId} onChange={e => handleClienteChange(e.target.value)}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} — {c.documento}</option>
                ))}
              </select>
              {clienteSeleccionado && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Límite de crédito:</span>
                    <span className="font-semibold">{formatCurrency(clienteSeleccionado.limite_credito)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Saldo pendiente:</span>
                    <span className={`font-semibold ${clienteSeleccionado.saldo_pendiente > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatCurrency(clienteSeleccionado.saldo_pendiente)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Crédito disponible:</span>
                    <span className={`font-bold ${creditoDisponible <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatCurrency(creditoDisponible)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Productos */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">Productos</h2>
                <button onClick={() => { setMostrarBuscador(true); setProductosFiltrados(productos.slice(0, 12)); }} className="btn-primary flex items-center gap-2 text-xs py-1.5">
                  <Plus className="w-3.5 h-3.5" /> Agregar producto
                </button>
              </div>

              {/* Buscador */}
              {mostrarBuscador && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    className="input pl-9"
                    placeholder="Buscar producto por nombre o SKU..."
                    value={buscarProducto}
                    onChange={e => buscarProductos(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setMostrarBuscador(false)}
                  />
                  {productosFiltrados.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 card shadow-lg overflow-hidden">
                      {productosFiltrados.map(p => (
                        <button
                          key={p.id}
                          onClick={() => agregarProducto(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <div>
                            <span className="font-mono text-xs text-blue-600 mr-2">{p.sku}</span>
                            <span className="font-medium">{p.nombre}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-emerald-600">{formatCurrency(p.precio_venta)}</div>
                            <div className="text-xs text-gray-400">Stock: {p.stock_actual}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {items.length === 0 ? (
                <div className="py-8 text-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Agregá productos a la venta</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium">{item.producto_nombre}</p>
                        <button onClick={() => eliminarItem(idx)} className="text-red-400 hover:text-red-600 p-0.5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div>
                          <label className="label text-xs">Cantidad</label>
                          <input
                            type="number" min="0.001" step="0.001"
                            className="input py-1.5"
                            value={item.cantidad}
                            onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Precio unitario</label>
                          <input
                            type="number" min="0" step="0.01"
                            className="input py-1.5"
                            value={item.precio_unitario}
                            onChange={e => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        {item.lotes_disponibles && item.lotes_disponibles.length > 0 && (
                          <div>
                            <label className="label text-xs">Lote (FEFO)</label>
                            <select
                              className="input py-1.5"
                              value={item.lote_id || ''}
                              onChange={e => actualizarItem(idx, 'lote_id', e.target.value)}
                            >
                              <option value="">Sin lote</option>
                              {item.lotes_disponibles.map(l => (
                                <option key={l.id} value={l.id}>
                                  {l.numero_lote} (Stock:{l.stock_actual}) {l.fecha_vencimiento ? `— vence ${formatDate(l.fecha_vencimiento)}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex items-end">
                          <div className="w-full">
                            <label className="label text-xs">Subtotal</label>
                            <div className="input py-1.5 bg-gray-100 dark:bg-gray-700 font-semibold text-emerald-600">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                      {item.numero_lote && (
                        <p className="text-xs text-blue-600 mt-1">
                          Lote: <strong>{item.numero_lote}</strong>
                          {item.fecha_vencimiento && ` · Vence: ${formatDate(item.fecha_vencimiento)}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Factura */}
            <div className="card p-5">
              <h2 className="section-title mb-4">Datos de factura (opcional)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Número de factura</label>
                  <input className="input" placeholder="0001-00001234" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} />
                </div>
                <div>
                  <label className="label">Punto de venta</label>
                  <input className="input" placeholder="0001" value={puntoVenta} onChange={e => setPuntoVenta(e.target.value)} />
                </div>
                <div>
                  <label className="label">N° de timbrado</label>
                  <input className="input" placeholder="12345678" value={timbrado} onChange={e => setTimbrado(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <label className="label">Observaciones</label>
                <textarea className="input" rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas adicionales..." />
              </div>
            </div>
          </div>

          {/* Sidebar totales */}
          <div className="space-y-4">
            <div className="card p-5 sticky top-4">
              <h2 className="section-title mb-4">Resumen</h2>

              {/* Condición de pago */}
              <div className="mb-4">
                <label className="label">Condición de pago</label>
                <div className="flex gap-2">
                  {(['contado', 'credito'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setCondicionPago(c)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                        condicionPago === c
                          ? c === 'contado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-2 ring-emerald-500'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 ring-2 ring-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {condicionPago === 'credito' && (
                <div className="space-y-3 mb-4 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                  <div>
                    <label className="label text-xs">Plazo (días)</label>
                    <input type="number" min="1" className="input py-1.5" value={plazoDias} onChange={e => setPlazoDias(parseInt(e.target.value) || 30)} />
                  </div>
                  <div>
                    <label className="label text-xs">Cantidad de cuotas</label>
                    <input type="number" min="1" max="36" className="input py-1.5" value={cantidadCuotas} onChange={e => setCantidadCuotas(parseInt(e.target.value) || 1)} />
                  </div>
                  {cuotasPreview.length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-purple-700 dark:text-purple-300">Plan de cuotas:</p>
                      {cuotasPreview.map(c => (
                        <div key={c.numero} className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>Cuota {c.numero} — {formatDate(c.fecha_vencimiento)}</span>
                          <span className="font-semibold">{formatCurrency(c.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Totales */}
              <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(subtotalBruto)}</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="text-gray-500">Descuento</span>
                  <input
                    type="number" min="0" step="0.01"
                    className="input py-1 w-28 text-right"
                    value={descuento}
                    onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span>TOTAL</span>
                  <span className="text-emerald-600">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Advertencia crédito */}
              {condicionPago === 'credito' && clienteSeleccionado && total > creditoDisponible && (
                <div className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                  ⚠️ El total supera el crédito disponible del cliente ({formatCurrency(creditoDisponible)})
                </div>
              )}

              <button
                onClick={confirmarVenta}
                disabled={saving || items.length === 0 || !clienteId}
                className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-2 text-base"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                {saving ? 'Registrando...' : 'Confirmar venta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
