'use client'
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import verifyToken from "../utils/VerifyToken";

const api = process.env.NEXT_PUBLIC_API_URL;

export default function Login(){
  const navigator = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (email === '' || password === '') {
      Swal.fire({
        title: 'Campos incompletos',
        text: 'Completa correo y contraseña para continuar.',
        icon: 'warning',
        confirmButtonText: 'Entendido',
        background: '#0a0f12',
        color: '#e5e7eb',
        confirmButtonColor: '#10b981' // emerald
      });
      return;
    }

    const payload = { email, password };

    try {
      const res = await axios.post(`${api}/auth/login`, payload);
      if (res.data.success) {
        try {
          const validate = await verifyToken(res.data.token);

          if (validate.valid) {
            localStorage.setItem("token", res.data.token);

            Swal.fire({
              title: 'Sesión iniciada',
              text: 'Redirigiendo al panel…',
              icon: 'success',
              confirmButtonText: 'Ir ahora',
              timer: 3500,
              timerProgressBar: true,
              allowOutsideClick: false,
              allowEscapeKey: false,
              confirmButtonColor: '#10b981',
              background: '#0a0f12',
              color: '#e5e7eb',
            }).then((result) => {
              if (result.isConfirmed || result.dismiss === Swal.DismissReason.timer) {
                navigator.push('/dashboard');
              }
            });
          } else {
            Swal.fire({
              title: 'Acceso denegado',
              text: 'Correo o clave incorrectos.',
              icon: 'error',
              confirmButtonText: 'Reintentar',
              background: '#0a0f12',
              color: '#e5e7eb',
              confirmButtonColor: '#f59e0b' // amber
            });
          }
        } catch (err) {
          Swal.fire({
            title: 'Acceso denegado',
            text: 'Correo o clave incorrectos.',
            icon: 'error',
            confirmButtonText: 'Reintentar',
            background: '#0a0f12',
            color: '#e5e7eb',
            confirmButtonColor: '#f59e0b'
          });
        }
      }
    } catch (err) {
      Swal.fire({
        title: 'Error de autenticación',
        text: 'Verifica tus credenciales o intenta más tarde.',
        icon: 'error',
        confirmButtonText: 'Ok',
        background: '#0a0f12',
        color: '#e5e7eb',
        confirmButtonColor: '#f59e0b'
      });
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b0d] text-white">
      {/* Background con vibes de mapa/logística */}
      <div className="pointer-events-none absolute inset-0">
        {/* cuadrícula tipo plano urbano */}
        <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay
          bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),
               linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]
          bg-[size:32px_32px]" />
        {/* rutas punteadas diagonales */}
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_10%,#24d3ee_0,transparent_25%),radial-gradient(circle_at_80%_70%,#10b981_0,transparent_22%)]" />
        {/* halo sutil */}
        <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-20"
             style={{ background: 'radial-gradient(closest-side,#24d3ee,transparent)' }} />
        <div className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-15"
             style={{ background: 'radial-gradient(closest-side,#10b981,transparent)' }} />
      </div>

      {/* Contenido */}
      <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Card estilo “control center” */}
          <div className="rounded-3xl p-[1px] bg-gradient-to-br from-cyan-500/30 via-emerald-500/20 to-teal-500/30 shadow-[0_0_40px_-12px_rgba(16,185,129,0.45)]">
            <div className="rounded-3xl bg-[#0a0f12]/80 backdrop-blur-xl p-8 border border-white/10">
              {/* Header con insignia logística */}
              <div className="mb-8 flex items-center gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-emerald-500/20">
                  {/* ícono “ruta” minimal */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h5a3 3 0 013 3v6a3 3 0 003 3h5" />
                    <circle cx="4" cy="6" r="2" fill="currentColor" className="text-emerald-400" />
                    <circle cx="20" cy="18" r="2" fill="currentColor" className="text-cyan-400" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Panel de Operaciones</h1>
                  <p className="text-sm text-zinc-400">Accede para gestionar rutas y entregas</p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitForm} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm text-zinc-300">Correo</label>
                  <div className="relative">
                    <input
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl bg-[#0d1417] border border-[#1c262b] px-4 py-3 pl-11 text-sm outline-none placeholder:text-zinc-500
                                 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/25 transition"
                    />
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                      {/* email icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-zinc-300">Contraseña</label>
                  <div className="relative">
                    <input
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl bg-[#0d1417] border border-[#1c262b] px-4 py-3 pl-11 pr-12 text-sm outline-none placeholder:text-zinc-600
                                 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/25 transition"
                    />
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                      {/* lock icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c-1.657 0-3 1.343-3 3v2h6v-2c0-1.657-1.343-3-3-3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V8a5 5 0 0110 0v3" />
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                      </svg>
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">
                      {/* eye-off decorative */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58A3 3 0 0012 15a3 3 0 002.12-.88M9.88 9.88A3 3 0 0115 12" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7c-1.7 0-3.22-.38-4.55-1.04" />
                      </svg>
                    </span>
                  </div>
                </div>

               

                <button
                  type="submit"
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 text-sm font-medium tracking-wide
                             shadow-[0_10px_30px_-12px_rgba(16,185,129,0.55)] transition hover:brightness-110 focus:outline-none"
                >
                  <span className="relative z-10">Iniciar sesión</span>
                  <span className="absolute inset-0 -translate-x-full bg-[radial-gradient(120px_60px_at_center,rgba(255,255,255,0.22),transparent)]
                                 transition-transform duration-700 group-hover:translate-x-0" />
                </button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#243239] to-transparent" />
                <span className="text-xs uppercase tracking-wider text-zinc-500">o</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#243239] to-transparent" />
              </div>

              {/* Footer */}
              <p className="mt-6 text-center text-sm text-zinc-400">
                ¿No tienes cuenta?{' '}
                <a href="/register" className="text-cyan-300 hover:text-cyan-200 transition">
                  Crear una
                </a>
              </p>
            </div>
          </div>

          {/* microtexto legal */}
          <p className="mt-6 text-center text-xs text-zinc-500">
            Cifrado en tránsito. Logs auditados. Café opcional, uptime obligatorio.
          </p>
        </div>
      </section>
    </main>
  );
}
