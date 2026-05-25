'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Users, Truck,
  CreditCard, Receipt, Factory, BarChart3, Leaf, ChevronLeft,
  ChevronRight, FileSpreadsheet, Settings2, DollarSign, BadgePercent,
  Handshake,
} from 'lucide-react';
import { useState } from 'react';

type NavItem = { href: string; icon: React.ElementType; label: string; exact?: boolean };
type NavSection = { label?: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { href: '/dashboard/productos', icon: Package, label: 'Productos' },
      { href: '/dashboard/stock', icon: Boxes, label: 'Stock & Lotes' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/dashboard/ventas', icon: ShoppingCart, label: 'Ventas' },
      { href: '/dashboard/cobros', icon: Handshake, label: 'Cobros' },
      { href: '/dashboard/clientes', icon: Users, label: 'Clientes' },
      { href: '/dashboard/proveedores', icon: Truck, label: 'Proveedores' },
      { href: '/dashboard/compras', icon: CreditCard, label: 'Compras' },
      { href: '/dashboard/gastos', icon: Receipt, label: 'Gastos' },
      { href: '/dashboard/produccion', icon: Factory, label: 'Producción' },
      { href: '/dashboard/comisiones', icon: BadgePercent, label: 'Comisiones' },
    ],
  },
  {
    label: 'Informes',
    items: [
      { href: '/dashboard/reportes', icon: BarChart3, label: 'Reportes' },
      { href: '/dashboard/reportes/rg90', icon: FileSpreadsheet, label: 'RG90' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/dashboard/configuracion', icon: Settings2, label: 'Configuración' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800', collapsed && 'justify-center px-2')}>
        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-lg shrink-0">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">SIRS</p>
            <p className="text-xs text-gray-400 leading-tight">Teixeira S.A.</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si} className={cn(si > 0 && 'mt-2')}>
            {!collapsed && section.label && (
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {section.label}
              </p>
            )}
            {collapsed && section.label && (
              <div className="mx-2 mb-1 border-t border-gray-100 dark:border-gray-800" />
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map(({ href, icon: Icon, label, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      title={collapsed ? label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
                        collapsed && 'justify-center'
                      )}
                    >
                      <Icon className={cn('shrink-0', active ? 'w-5 h-5' : 'w-4 h-4')} />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 z-10 shadow-sm"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
