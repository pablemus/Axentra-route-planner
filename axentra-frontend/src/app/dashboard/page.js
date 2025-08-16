'use client'
import { motion } from 'framer-motion';
import jwt from 'jsonwebtoken';
import { ChevronLeft, ChevronRight, LogOut, Map, Menu } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

// === tus componentes (ajusta rutas) ===
const PlanificadorRutas = dynamic(() => import('@/app/components/View/PlanificadorRutas'), { ssr: false });
// ejemplo liviano (puedes borrarlo si ya tienes otro)


export default function DashboardLayout() {
  const navigator = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [rol, setRol] = useState('');

  // 1) lista de componentes: UN BOTÓN POR COMPONENTE
  const routes = useMemo(() => ([
    { id: 'planificador', label: 'Planificador de Rutas', icon: Map,   element: <PlanificadorRutas /> },
  ]), []);

  // 2) ruta activa
  const [activeRoute, setActiveRoute] = useState(routes[0]?.id || null);

  // 3) componente actual
  const current = useMemo(
    () => routes.find(r => r.id === activeRoute) || null,
    [routes, activeRoute]
  );

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { navigator.push('/login'); return; }
    const decoded = jwt.decode(token);
    setUser(decoded || null);
    setRol(decoded?.role === 'ADMIN' ? 'Admin' : 'User');
  }, [navigator]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigator.push('/login');
  };

  const bg = 'bg-[#070b0d]';
  const panel = 'bg-[#0a0f12]/85 backdrop-blur-xl border border-white/10';
  const hover = 'hover:bg-white/5';
  const ring  = 'focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/60';

  return (
    <div className={`${bg} min-h-screen text-zinc-100`}>
      {/* header */}
      <header className={`sticky top-0 z-40 ${panel}`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setSidebarOpen(v => !v)} className={`p-2 rounded-lg ${hover} lg:hidden`} aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Image src="/navpath.png" alt="Logo" className="h-8 w-8 rounded-sm" width={32} height={32} />
            <span className="text-sm text-emerald-400">NavPath</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user && <div className="text-xs text-zinc-400">{user.username} — <span className="text-emerald-400">{rol}</span></div>}
            <button onClick={handleLogout} className={`px-3 py-1.5 rounded-lg border border-white/10 ${hover} ${ring} text-xs`}>
              <span className="inline-flex items-center gap-2"><LogOut size={14}/>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* layout */}
      <div className="flex">
        {/* SIDEBAR: un botón por componente */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 200 : 72 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className={`sticky top-[56px] h-[calc(100vh-56px)] ${panel} ${bg} hidden lg:flex flex-col`}
        >
          <div className={`flex items-center gap-2 border-b border-white/10 py-2 ${sidebarOpen ? '' : 'px-4'}`}>
            <button onClick={() => setSidebarOpen(v => !v)} className={`ml-auto p-2 rounded-lg ${hover}`} title={sidebarOpen ? 'Contraer' : 'Expandir'}>
              {sidebarOpen ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 overflow-x-hidden">
            {routes.map(item => {
              const Icon = item.icon;
              const active = item.id === activeRoute;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveRoute(item.id)}
                  className={`group relative w-full flex items-center ${sidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center py-3'}
                              text-sm transition ${hover} `}
                  aria-label={item.label}
                >
                  {Icon ? <Icon size={20}/> : <span className="w-5 h-5 rounded bg-zinc-600/40" />}
                  <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'} transition-opacity`}>{item.label}</span>
                  {!sidebarOpen && (
                    <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2
                                     whitespace-nowrap rounded-md border border-white/10 bg-[#0d1417] px-2 py-1
                                     text-xs text-zinc-200 opacity-0 shadow-lg group-hover:opacity-100"
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* SLOT: aquí se renderiza el componente seleccionado */}
         
        </motion.aside>

      <div className='flex-1'>
        {current?.element ??(
            <div className="flex items-center justify-center h-full text-zinc-500">
      Selecciona una opción del menú
    </div>
        )}
      </div>
      </div>
      
    </div>
  );
}
