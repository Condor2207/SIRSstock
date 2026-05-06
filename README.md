# SIRS - Sistema Integral de Gestión para Edulcorantes

Sistema full-stack de gestión comercial para empresas productoras y distribuidoras de edulcorantes.

## Stack

- **Next.js 14** + TypeScript
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Tailwind CSS** + Componentes propios
- **next-themes** (dark/light mode)
- **recharts** (gráficos)

## Funcionalidades

- ✅ Stock con trazabilidad por lote y vencimiento (FEFO)
- ✅ Ventas al contado y a crédito con cuotas
- ✅ Facturación electrónica (campos para número/punto de venta)
- ✅ Gestión de clientes con límite de crédito
- ✅ Proveedores y compras
- ✅ Control de producción con lotes
- ✅ Gastos generales
- ✅ Reportes y dashboards
- ✅ Alertas de stock bajo y vencimientos próximos

## Instalación

### 1. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar el archivo `supabase/migrations/001_init.sql`
3. Copiar URL y Anon Key desde **Settings → API**

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase
```

### 3. Instalar y ejecutar

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

### 4. Usuario demo

Crear un usuario en Supabase **Authentication → Users → Add User**:
- Email: `admin@sirs.com`
- Password: `Admin123!`

## Deploy en Vercel

1. Push a GitHub
2. Conectar repositorio en [vercel.com](https://vercel.com)
3. Agregar variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy automático

## Estructura del proyecto

```
├── app/                    # Next.js App Router
│   ├── login/              # Página de login
│   └── dashboard/          # Módulos del sistema
│       ├── page.tsx        # Dashboard principal
│       ├── productos/      # Catálogo de productos
│       ├── stock/          # Stock y lotes
│       ├── ventas/         # Ventas (lista + nueva venta)
│       ├── clientes/       # Gestión de clientes
│       ├── proveedores/    # Gestión de proveedores
│       ├── compras/        # Registro de compras
│       ├── gastos/         # Gastos generales
│       ├── produccion/     # Control de producción
│       └── reportes/       # Reportes y estadísticas
├── components/             # Componentes reutilizables
├── lib/                    # Supabase client + tipos + utilidades
└── supabase/migrations/    # Schema SQL de la base de datos
```
