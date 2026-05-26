'use client';

import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Building2, Ruler, Tag, Percent, List,
  Handshake, UserCheck, Landmark, Settings2,
} from 'lucide-react';

const configCards = [
  { href: '/dashboard/configuracion/empresa', icon: Building2, label: 'Empresa', desc: 'Datos fiscales, timbrado y punto de expedición', color: 'blue' },
  { href: '/dashboard/configuracion/unidades', icon: Ruler, label: 'Unidades de Medida', desc: 'Unidad, kg, lts, cjs, etc.', color: 'emerald' },
  { href: '/dashboard/configuracion/clasificaciones', icon: Tag, label: 'Clasificaciones', desc: 'Mercadería, Materia Prima, Servicio...', color: 'purple' },
  { href: '/dashboard/configuracion/tasas-iva', icon: Percent, label: 'Tasas de IVA', desc: 'Exento, IVA 5%, IVA 10%', color: 'orange' },
  { href: '/dashboard/configuracion/listas-precios', icon: List, label: 'Listas de Precios', desc: 'Consumo, Distribuidor, HORECA...', color: 'teal' },
  { href: '/dashboard/configuracion/marcas', icon: Tag, label: 'Marcas / Líneas / Grupos', desc: 'Jerarquía de agrupación de productos', color: 'pink' },
  { href: '/dashboard/configuracion/condiciones', icon: Handshake, label: 'Condiciones de Venta', desc: 'Contado, 30/60/90 días, cuotas...', color: 'yellow' },
  { href: '/dashboard/configuracion/vendedores', icon: UserCheck, label: 'Vendedores', desc: 'Equipo comercial y comisiones', color: 'cyan' },
  { href: '/dashboard/configuracion/bancos', icon: Landmark, label: 'Bancos', desc: 'Entidades bancarias para cheques', color: 'indigo' },
];

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 group-hover:bg-orange-100',
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 group-hover:bg-teal-100',
  pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 group-hover:bg-pink-100',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-100',
  cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-100',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100',
};

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col min-h-full">
      <Header title="Configuración del Sistema" />
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Settings2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tablas maestras y parámetros</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Administrá la información base del sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {configCards.map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="group card p-5 flex items-start gap-4 hover:shadow-md transition-all"
            >
              <div className={`p-3 rounded-xl transition-colors ${colorMap[color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
