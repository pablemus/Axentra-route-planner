'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import polyline from '@mapbox/polyline';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid';

// === SweetAlert helpers (reemplazo de Toast) ===
const notify = {
  loading(title = 'Cargando...', html = '<div class="pablo-loader"></div>') {
    Swal.fire({
      title,
      html,
      allowOutsideClick: false,
      allowEscapeKey: false,
      background: '#0b0b10',
      color: '#e5ffe9',
      didOpen: () => Swal.showLoading(),
      customClass: { popup: 'rounded-2xl border border-emerald-600/30 shadow-xl' }
    });
  },
  close() { Swal.close(); },
  success(text = 'Listo', ms = 1800) {
    Swal.fire({
      icon: 'success', title: 'Éxito', text,
      timer: ms, showConfirmButton: false,
      background: '#0b0b10', color: '#e5ffe9', iconColor: '#10b981',
      customClass: { popup: 'rounded-2xl border border-emerald-600/30' }
    });
  },
  error(text = 'Ocurrió un error') {
    Swal.fire({
      icon: 'error', title: 'Error', text,
      background: '#0b0b10', color: '#e5ffe9', iconColor: '#ef4444',
      confirmButtonColor: '#10b981',
      customClass: { popup: 'rounded-2xl border border-emerald-600/30' }
    });
  },
  warn(text = 'Atención') {
    Swal.fire({
      icon: 'warning', title: 'Aviso', text,
      background: '#0b0b10', color: '#e5ffe9', iconColor: '#f59e0b',
      confirmButtonColor: '#10b981',
      customClass: { popup: 'rounded-2xl border border-emerald-600/30' }
    });
  },
  info(text = 'Procesando...') {
    Swal.fire({
      icon: 'info', title: 'Info', text,
      background: '#0b0b10', color: '#e5ffe9', iconColor: '#60a5fa',
      confirmButtonColor: '#10b981',
      customClass: { popup: 'rounded-2xl border border-emerald-600/30' }
    });
  }
};

// === APIS
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const port   = process.env.NEXT_PUBLIC_PORT_API;

// === CEDIS
const centrosDistribucion = {
  'Las Palmas':{ lat: 14.452001745913762, lng: -90.64185192063206 }
};
const opcionesCentros = [
  { label: 'Las Palmas', value: 'Las Palmas' }
];

// === Map
const DynamicMap = dynamic(() => import('@/app/components/Maps/Mapview'), { ssr: false });

// === Utils
const normalizeWaypoint = (wp) => {
  const pedidos = Array.isArray(wp.pedidos)
    ? (Array.isArray(wp.pedidos[0]) ? wp.pedidos.flat() : wp.pedidos)
    : [];
  return { ...wp, pedidos, rutaId: wp.rutaId ?? null, id: wp.id ?? uuidv4() };
};
const dedupeByLatLng = (arr) => {
  const seen = new Set();
  return arr.filter(wp => {
    const key = `${Number(wp.lat).toFixed(6)},${Number(wp.lng).toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const samePoint = (a, b) =>
  Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;

// === RESUMEN reusable
/** Construye un resumen estándar a partir de waypoints */
function calcularResumen({ rutaId, puntos = [], distancia = 0, duracionSegundos = 0 }) {
  const pedidos = [];
  let totalPeso = 0;
  let totalPorcentaje = 0;

  puntos.forEach(wp => {
    (wp.pedidos || []).forEach(p => {
      pedidos.push({
        Pedido: p.Pedido,
        "Nombre Cliente": p["Nombre Cliente"] || "Sin nombre"
      });
      totalPeso       += p.Peso || 0;
      totalPorcentaje += p.PorcentajeCarga || 0;
    });
  });

  return {
    id: rutaId,
    pedidos,
    totalPeso,
    totalPorcentaje: +totalPorcentaje.toFixed(2),
    distancia,
    puntos,
    tiempo: (duracionSegundos || 0) / 3600
  };
}

const PlanificacionRutas = ({ setSelectedView }) => {
  const fileUploadRef = useRef(null);
  const [fileName, setFileName] = useState('Seleccionar archivo');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [resumenesCarga, setResumenesCarga] = useState([]);
  const [resumenAbiertos, setResumenAbiertos] = useState([]);
  const [visible, setVisible] = useState(false);
  const [fileUploadKey, setFileUploadKey] = useState(0);
  const [centroSeleccionado, setCentroSeleccionado] = useState(null);
  const [rutasAbiertas, setRutasAbiertas] = useState({});
  const [currentSelection, setCurrentSelection] = useState([]);
  const [mapKey, setMapKey] = useState(0);
  const [abrirSidePanel, setAbrirSidePanel] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [waypointSeleccionado, setWaypointSeleccionado] = useState(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState(undefined);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [imprimirDialogV, setImprimirDialogV] = useState(false);
  const [modoEditar, setModoEditar] = useState(false);
  const mapRef = useRef(null);
  const [desvioCoords, setDesvioCoords] = useState([null, null]);

  const [viaWaypoints, setViaWaypoints] = useState([]);
  const [viasByRoute, setViasByRoute] = useState({});
  const [modoDesvio, setModoDesvio] = useState(false);
  const getVias = (rutaId) => viasByRoute[rutaId] || [];
  const onAddVia = (rutaId, latlng) => {
    setViasByRoute(prev => {
      const arr = prev[rutaId] ? [...prev[rutaId]] : [];
      arr.push({ lat: +latlng.lat, lng: +latlng.lng });
      return { ...prev, [rutaId]: arr };
    });
  };
  const onMoveVia = (rutaId, index, latlng) => {
    setViasByRoute(prev => {
      const arr = (prev[rutaId] || []).slice();
      if (arr[index]) arr[index] = { lat: +latlng.lat, lng: +latlng.lng };
      return { ...prev, [rutaId]: arr };
    });
  };
  const onDeleteVia = (rutaId, index) => {
    setViasByRoute(prev => {
      const arr = (prev[rutaId] || []).slice();
      arr.splice(index, 1);
      return { ...prev, [rutaId]: arr };
    });
  };

  // === Cargar desde LocalStorage (edición temporal)
  useEffect(() => {
    const g = localStorage.getItem("geometria");
    const w = localStorage.getItem("waypoints");
    const resumen = JSON.parse(localStorage.getItem("datosResumen"));
    if (!g || !w) return;

    (async () => {
      try {
        setLoading(true);
        notify.loading('Cargando ruta...');

        const parsed  = JSON.parse(w);
        const fromLS  = (Array.isArray(parsed) ? parsed : parsed?.waypoints ?? []).map(normalizeWaypoint);

        setModoEditar(true);
        const centerName = (centroSeleccionado ?? 'Las Palmas');
        setCentroSeleccionado(prev => prev ?? 'Las Palmas');
        const center = centrosDistribucion[centerName];

        const payload = [
          center,
          ...fromLS.map(wp => ({ lat: wp.lat, lng: wp.lng })),
          center
        ];

        const res  = await fetch(`${apiUrl}:${port}/api/v1/rutanopti`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const routeData = data?.routes?.[0];
        if (!routeData) throw new Error('No se recibió ruta optimizada');

        // Ordenar según steps -> jobs
        const keyOf = (wp) => `${Number(wp.lat).toFixed(6)},${Number(wp.lng).toFixed(6)}`;
        const ordered = routeData.steps
          .filter(s => s.type === 'job' && Array.isArray(s.location))
          .map(s => {
            const [lng, lat] = s.location;
            const k = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
            return fromLS.find(wp => keyOf(wp) === k);
          })
          .filter(Boolean);

        const puntosOptim = ordered.length ? ordered : fromLS;

        localStorage.setItem("geometria", routeData.geometry);
        localStorage.setItem("waypoints", JSON.stringify(puntosOptim));

        const distanciaMetros = routeData.distance || 0;
        const resumenTemp = calcularResumen({
          rutaId: 'ruta_temp_ls',
          puntos: puntosOptim,
          distancia: distanciaMetros,
          duracionSegundos: routeData.duration || 0
        });

        // Routes + Waypoints + Resumen
        setRoutes(prev => ([
          ...prev,
          {
            id: 'ruta_temp_ls',
            name: resumen?.NumeroDeRuta ?? 'TEMP',
            geometry: routeData.geometry,
            puntos: puntosOptim.map(wp => ({ ...wp, rutaId: wp.rutaId ?? null, id: wp.id ?? uuidv4() })),
            center,
            centerName,
            distance: distanciaMetros,
            color: '#e6194b'
          }
        ]));

        setWaypoints(prev => dedupeByLatLng([
          ...prev,
          ...puntosOptim.map(wp => ({ ...wp, id: wp.id ?? uuidv4(), rutaId: 'ruta_temp_ls' }))
        ]));

        setResumenesCarga(prev => {
          const i = prev.findIndex(r => r.id === resumenTemp.id);
          if (i !== -1) { const copy = [...prev]; copy[i] = resumenTemp; return copy; }
          return [...prev, resumenTemp];
        });

        handleProcessClick(); // opcional, como ya lo tenías
      } catch (e) {
        console.error("Error optimizando lo del LS: ", e);
      } finally{
        setLoading(false);
        notify.close();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Sidebar
  const toggleRuta = (index) => {
    setRutasAbiertas(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // === Botón principal: cargar pendientes
  const handleProcessClick = async () => {
    if (!centroSeleccionado) setCentroSeleccionado('Las Palmas');

    setMapKey(k => k + 1);
    setLoading(true);
    notify.loading('Cargando pedidos pendientes...');

    try {
      const response = await fetch(`${apiUrl}:${port}/api/v1/getData`, { method: 'POST' });
      const data = await response.json();

      if (data?.waypoints_con_nombre) {
        const fetched = data.waypoints_con_nombre.map(wp => ({
          ...wp, rutaId: wp.rutaId ?? null, id: wp.id ?? uuidv4(),
        }));
        setWaypoints(prev => dedupeByLatLng([...prev, ...fetched]));
      } else {
        notify.close();
        notify.warn('No se encontraron waypoints');
      }
    } catch (error) {
      console.error('Error al procesar archivo:', error);
      notify.close();
      notify.error('Hubo un problema al procesar el archivo');
    } finally {
      setLoading(false);
      notify.close();
      fileUploadRef.current?.clear?.();
      setFileUploadKey(prev => prev + 1);
    }
  };

  // === Eliminar selección de waypoints desde una ruta + regenerar resúmenes
  const handleRemoveWaypoints = (seleccion) => {
    const nuevasRutas = routes.filter(rutaObj =>
      !rutaObj.puntos.some(wp =>
        seleccion.some(s => s.lat === wp.lat && s.lng === wp.lng)
      )
    );
    setRoutes(nuevasRutas);

    const waypointsRestantes = nuevasRutas.flatMap(r => r.puntos);
    if (waypointsRestantes.length < 2) {
      setResumenesCarga([]);
      return;
    }

    // reconstruye TODOS los resúmenes con la función reusable
    setResumenesCarga(nuevasRutas.map(r =>
      calcularResumen({
        rutaId: r.id,
        puntos: r.puntos,
        distancia: r.distance || 0,
        duracionSegundos: 0 // si no lo tienes disponible aquí
      })
    ));
  };

  // === Click en waypoint (diálogo)
  const handleWaypointClick = (wp) => {
    if (modoDesvio) {
      const coordenadasWp = [wp.lng, wp.lat];
      const map = mapRef.current;
      map.once('click', function (e) {
        const { lat, lng } = e.latlng;
        setDesvioCoords([lng, lat]);
        window.L.marker([lat, lng]).addTo(map);
      });
      return;
    }
    setWaypointSeleccionado(wp);
    setDialogVisible(true);
  };

  // === Quitar un waypoint de su ruta y reoptimizar
  const handleUnassignWaypoint = async (waypoint) => {
    setLoading(true);
    notify.loading('Eliminando waypoint...');

    const rutaId = waypoint?.rutaId ?? null;
    if (rutaId === null) {
      notify.close();
      notify.warn('Esa dirección no está asignada a ninguna ruta');
      setLoading(false);
      return;
    }

    const nuevosWaypoints = waypoints.map((wp) =>
      samePoint(wp, waypoint) ? { ...wp, rutaId: null } : wp
    );
    setWaypoints(nuevosWaypoints);

    const waypointsDeRuta = nuevosWaypoints.filter((wp) => wp.rutaId === rutaId);

    if (waypointsDeRuta.length < 1) {
      setRoutes((prev) => prev.filter((r) => r.id !== rutaId));
      setResumenesCarga((prev) => prev.filter((r) => r.id !== rutaId));
      notify.close();
      notify.warn('Ruta eliminada: no hay suficientes puntos');
      setLoading(false);
      return;
    }

    const rutaOriginal = routes.find((r) => r.id === rutaId);
    if (!rutaOriginal) {
      setLoading(false);
      notify.close();
      return;
    }

    const { center } = rutaOriginal;
    const puntosRuta = [ center, ...waypointsDeRuta.map(wp => ({ lat: wp.lat, lng: wp.lng })), center ];

    try {
      const res = await fetch(`${apiUrl}:${port}/api/v1/rutanopti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(puntosRuta)
      });
      const data = await res.json();

      if (data?.routes?.[0]) {
        const r0 = data.routes[0];
        setRoutes(prev =>
          prev.map((r) => r.id === rutaId
            ? { ...r, geometry: r0.geometry, distance: r0.distance, puntos: waypointsDeRuta }
            : r
          )
        );

        const nuevoResumen = calcularResumen({
          rutaId,
          puntos: waypointsDeRuta,
          distancia: r0.distance || 0,
          duracionSegundos: r0.duration || 0
        });

        setResumenesCarga((prev) => prev.map((r) => (r.id === rutaId ? { ...r, ...nuevoResumen } : r)));
      }

      notify.close();
      notify.success('Dirección desasignada');
    } catch (err) {
      console.error('Error recalculando ruta:', err);
      notify.close();
      notify.error('No se pudo recalc. la ruta');
    } finally {
      setLoading(false);
    }
  };

  // === Merge selección en ruta de edición temporal
  const EDIT_ROUTE_ID = 'ruta_temp_ls';
  const mergeIntoEditRoute = async (seleccion) => {
    const ruta = routes.find(r => r.id === EDIT_ROUTE_ID);
    if (!ruta) { notify.warn('No hay ruta en edición'); return; }
    if (!Array.isArray(seleccion) || seleccion.length === 0) { notify.warn('No seleccionaste direcciones'); return; }

    const keyOf = (wp) => `${Number(wp.lat).toFixed(6)},${Number(wp.lng).toFixed(6)}`;
    const byKey = new Map();
    const addWP = (wp) => {
      const k = keyOf(wp);
      if (byKey.has(k)) {
        const prev = byKey.get(k);
        const pedidosPrev = Array.isArray(prev.pedidos) ? prev.pedidos : [];
        const pedidosNew  = Array.isArray(wp.pedidos)  ? wp.pedidos  : [];
        byKey.set(k, { ...prev, ...wp, rutaId: EDIT_ROUTE_ID, pedidos: [...pedidosPrev, ...pedidosNew], id: prev.id ?? wp.id ?? uuidv4() });
      } else {
        byKey.set(k, { ...wp, rutaId: EDIT_ROUTE_ID, pedidos: Array.isArray(wp.pedidos) ? wp.pedidos : [], id: wp.id ?? uuidv4() });
      }
    };
    ruta.puntos.forEach(addWP);
    seleccion.forEach(addWP);
    const nuevosPuntos = Array.from(byKey.values());

    const puntosPayload = [ ruta.center, ...nuevosPuntos.map(wp => ({ lat: wp.lat, lng: wp.lng })), ruta.center ];

    setLoading(true);
    notify.loading('Actualizando ruta');

    try {
      const res  = await fetch(`${apiUrl}:${port}/api/v1/rutanopti`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(puntosPayload)
      });
      const data = await res.json();
      const routeData = data?.routes?.[0];
      if (!routeData) throw new Error('No se recibió ruta');

      const ordered = routeData.steps
        .filter(s => s.type === 'job')
        .map(s => {
          const [lng, lat] = s.location;
          const k = `${lat.toFixed(6)},${lng.toFixed(6)}`;
          return nuevosPuntos.find(wp => keyOf(wp) === k);
        })
        .filter(Boolean);

      setRoutes(prev => prev.map(r =>
        r.id === EDIT_ROUTE_ID ? { ...r, puntos: ordered, geometry: routeData.geometry, distance: routeData.distance } : r
      ));

      // pool global
      setWaypoints(prev => {
        const map = new Map(prev.map(wp => [keyOf(wp), wp]));
        nuevosPuntos.forEach(wp => {
          const k = keyOf(wp);
          const exist = map.get(k);
          if (exist) {
            const pedidosPrev = Array.isArray(exist.pedidos) ? exist.pedidos : [];
            const pedidosNew  = Array.isArray(wp.pedidos)    ? wp.pedidos    : [];
            map.set(k, { ...exist, rutaId: EDIT_ROUTE_ID, id: exist.id ?? wp.id ?? uuidv4(), pedidos: [...pedidosPrev, ...pedidosNew] });
          } else {
            map.set(k, wp);
          }
        });
        return Array.from(map.values());
      });

      const nuevoResumen = calcularResumen({
        rutaId: EDIT_ROUTE_ID,
        puntos: ordered,
        distancia: routeData.distance,
        duracionSegundos: routeData.duration || 0
      });

      setResumenesCarga(prev => {
        const i = prev.findIndex(r => r.id === EDIT_ROUTE_ID);
        if (i !== -1) { const copy = [...prev]; copy[i] = { ...copy[i], ...nuevoResumen }; return copy; }
        return [...prev, nuevoResumen];
      });

      notify.close();
      notify.success('Ruta actualizada');
    } catch (err) {
      console.error(err);
      notify.close();
      notify.error('No se pudo actualizar la ruta en edición');
    } finally {
      setLoading(false);
    }
  };

  // === Selección desde el mapa → crear/actualizar ruta
  const handleSelectWaypoints = async ({ waypoints: seleccion, color, id, name }) => {
    if (modoEditar) { await mergeIntoEditRoute(seleccion); return; }


    if (seleccion.length < 2) {
      setRoutes(prev => prev.filter(r => r.id !== id));
      setResumenesCarga(prev => prev.filter(r => r.id !== id));
      notify.error('Debes seleccionar al menos 2 puntos');
      return;
    }

    const centro = centrosDistribucion[centroSeleccionado];
    const puntosRuta = [ { lat: centro.lat, lng: centro.lng }, ...viaWaypoints, ...seleccion ];

    notify.loading('Cargando rutas...');

    try {
      const response = await fetch(`${apiUrl}:${port}/api/v1/rutanopti`, {
        method: 'POST', body: JSON.stringify(puntosRuta), headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data && data.routes) {
        const route = data.routes[0];
        const orderedWaypoints = route.steps
          .filter(s => s.type === 'job')
          .map(s => {
            const [lng, lat] = s.location;
            return seleccion.find(wp =>
              Math.abs(wp.lat - lat) < 1e-6 && Math.abs(wp.lng - lng) < 1e-6
            );
          })
          .filter(Boolean);

        const nuevaRuta = {
          name, id,
          geometry: route.geometry,
          puntos: orderedWaypoints,
          center: centro,
          centerName: centroSeleccionado,
          distance: route.distance || 0,
          color
        };

        setRoutes(prev => {
          const idx = prev.findIndex(r => r.id === nuevaRuta.id);
          if (idx !== -1) { const copia = [...prev]; copia[idx] = nuevaRuta; return copia; }
          return [...prev, nuevaRuta];
        });

        const nuevoResumen = calcularResumen({
          rutaId: id,
          puntos: orderedWaypoints,
          distancia: route.distance || 0,
          duracionSegundos: route.duration || 0
        });

        setResumenesCarga(prev => {
          const index = prev.findIndex(r => r.id === id);
          if (index !== -1) { const copia = [...prev]; copia[index] = nuevoResumen; return copia; }
          return [...prev, nuevoResumen];
        });

        setAbrirSidePanel(true);
      } else {
        notify.close();
        notify.error('Hubo un problema al generar la ruta');
      }
    } catch (error) {
      console.error('Error al obtener ruta:', error);
    } finally {
      notify.close();
      notify.success('Ruta cargada', 1500);
    }
  };

  const obtenerColorPorRutaId = (id) => routes.find(r => r.id === id)?.color;
  const obtenerNombrePorRutaId = (id) => routes.find(r => r.id === id)?.name;

  // === DnD (reordenar puntos)
  function SortableItem({ id, nombre }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      backgroundColor: '#0f1115',
      transform: CSS.Transform.toString(transform),
      transition, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none'
    };
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}
           className="flex items-start gap-2 p-2 bg-gray-50 rounded mb-1">
        <div className="w-4 h-4 rounded-full border-2 border-green-900 bg-green-400 mt-1"/>
        <div className="text-sm">{nombre}</div>
      </div>
    );
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }));

  const handleDragEnd = async (event, rutaId) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setRoutes(prev =>
      prev.map(r => {
        if (r.id !== rutaId) return r;

        const oldIndex = r.puntos.findIndex(wp => wp.id === active.id);
        const newIndex = r.puntos.findIndex(wp => wp.id === over.id);
        const nuevosPuntos = arrayMove(r.puntos, oldIndex, newIndex);

        const payload = [ r.center, ...nuevosPuntos.map(wp => ({ lat: wp.lat, lng: wp.lng })), r.center ];

        axios.post(`${apiUrl}:${port}/api/v1/ruta`, payload)
          .then(res => {
            setLoading(true);
            notify.loading('Regenerando rutas...');
            const routeData = res.data.routes?.[0];
            if (routeData) {
              setRoutes(current => current.map(rr => rr.id !== rutaId
                ? rr
                : { ...rr, geometry: routeData.geometry, distance: routeData.distance, puntos: nuevosPuntos }
              ));

              const nuevoResumen = calcularResumen({
                rutaId,
                puntos: nuevosPuntos,
                distancia: routeData.distance || 0,
                duracionSegundos: routeData.duration || 0
              });
              setResumenesCarga(curr => curr.map(rsum => rsum.id === rutaId ? { ...rsum, ...nuevoResumen } : rsum));
            }
          })
          .catch(console.error)
          .finally(() => { setLoading(false); notify.close(); });

        return { ...r, puntos: nuevosPuntos };
      })
    );
  };

  // === Reoptimizar (distancia)
  const handleReoptimize = async (ruta) => {
    const puntosPayload = [ ruta.center, ...ruta.puntos.map(wp => ({ lat: wp.lat, lng: wp.lng })) ];
    try {
      setLoading(true);
      notify.loading('Re optimizando rutas...');
      const res = await fetch(`${apiUrl}:${port}/api/v1/rutanopti`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(puntosPayload)
      });
      const data = await res.json();
      if (!data.routes?.length) throw new Error('No routes');

      const newRouteData = data.routes[0];
      const orderedWaypoints = newRouteData.steps
        .filter(s => s.type === 'job')
        .map(s => {
          const [lng, lat] = s.location;
          return ruta.puntos.find(wp => Math.abs(wp.lat - lat) < 1e-6 && Math.abs(wp.lng - lng) < 1e-6);
        })
        .filter(Boolean);

      setRoutes(prev => prev.map(r => r.id !== ruta.id ? r : {
        ...r, puntos: orderedWaypoints, geometry: newRouteData.geometry, distance: newRouteData.distance
      }));

      const nuevoResumen = calcularResumen({
        rutaId: ruta.id,
        puntos: orderedWaypoints,
        distancia: newRouteData.distance,
        duracionSegundos: newRouteData.duration || 0
      });
      setResumenesCarga(prev => prev.map(rsum => rsum.id === ruta.id ? { ...rsum, ...nuevoResumen } : rsum));

    } catch (err) {
      console.error(err);
      notify.error('No se pudo reoptimizar');
    } finally {
      setLoading(false);
      notify.close();
      notify.success('Ruta actualizada');
    }
  };

  // === Reoptimizar (tiempo)
  const handleReoptimizeT = async (ruta) => {
    const puntosPayload = [ ruta.center, ...ruta.puntos.map(wp => ({ lat: wp.lat, lng: wp.lng })) ];
    try {
      setLoading(true);
      notify.loading('Re optimizando rutas...');
      const res = await fetch(`${apiUrl}:${port}/api/v1/rutanoptiT`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(puntosPayload)
      });
      const data = await res.json();
      if (!data.routes?.length) throw new Error('No routes');

      const newRouteData = data.routes[0];
      const orderedWaypoints = newRouteData.steps
        .filter(s => s.type === 'job')
        .map(s => {
          const [lng, lat] = s.location;
          return ruta.puntos.find(wp => Math.abs(wp.lat - lat) < 1e-6 && Math.abs(wp.lng - lng) < 1e-6);
        })
        .filter(Boolean);

      setRoutes(prev => prev.map(r => r.id !== ruta.id ? r : {
        ...r, puntos: orderedWaypoints, geometry: newRouteData.geometry, distance: newRouteData.distance
      }));

      const nuevoResumen = calcularResumen({
        rutaId: ruta.id,
        puntos: orderedWaypoints,
        distancia: newRouteData.distance,
        duracionSegundos: newRouteData.duration || 0
      });
      setResumenesCarga(prev => prev.map(rsum => rsum.id === ruta.id ? { ...rsum, ...nuevoResumen } : rsum));

    } catch (err) {
      console.error(err);
      notify.error('No se pudo reoptimizar');
    } finally {
      setLoading(false);
      notify.close();
      notify.success('Ruta actualizada');
    }
  };

  // === Asignar un waypoint a una ruta
  const handleAssignWaypoint = (waypoint, rutaId) => {
    setLoading(true);
    notify.loading('Cargando rutas...');

    setWaypoints(prevWaypoints => {
      const nuevosWaypoints = prevWaypoints.map(wp =>
        wp.lat === waypoint.lat && wp.lng === waypoint.lng ? { ...wp, rutaId } : wp
      );

      const waypointsDeRuta = nuevosWaypoints.filter(wp => wp.rutaId === rutaId);
      if (waypointsDeRuta.length < 1) {
        notify.close(); notify.warn('No hay puntos suficientes para crear la ruta');
        return nuevosWaypoints;
      }

      const rutaOriginal = routes.find(r => r.id === rutaId);
      if (!rutaOriginal) {
        notify.close(); notify.error('La ruta especificada no existe');
        return nuevosWaypoints;
      }

      const { center } = rutaOriginal;
      const puntosRuta = [ center, ...waypointsDeRuta.map(wp => ({ lat: wp.lat, lng: wp.lng })), center ];

      fetch(`${apiUrl}:${port}/api/v1/rutanopti`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(puntosRuta)
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.routes) {
            const r0 = data.routes[0];
            setRoutes(prev => prev.map(r => r.id === rutaId
              ? { ...r, geometry: r0.geometry, distance: r0.distance, puntos: waypointsDeRuta }
              : r
            ));

            const nuevoResumen = calcularResumen({
              rutaId,
              puntos: waypointsDeRuta,
              distancia: r0.distance || 0,
              duracionSegundos: r0.duration || 0
            });
            setResumenesCarga(prev => prev.map(r => r.id === rutaId ? { ...r, ...nuevoResumen } : r));

            setLoading(false);
            notify.close();
            notify.success('Dirección asignada');
          }
        });

      return nuevosWaypoints;
    });
  };

  const clearEditLS = () => {
    ['geometria', 'waypoints', 'datosResumen', 'ruta_temp_ls'].forEach(k => localStorage.removeItem(k));
  };

  // === Recalcular cuando cambian vías (solo geometry/distance/tiempo; NO tocar puntos)
  useEffect(() => {
    Object.entries(viasByRoute).forEach(([rutaId, vias]) => {
      const ruta = routes.find(r => r.id === rutaId);
      if (!ruta) return;

      const payload = [
        ruta.center,
        ...vias.map(v => ({ lat: v.lat, lng: v.lng })),
        ...ruta.puntos.map(wp => ({ lat: wp.lat, lng: wp.lng })),
        ruta.center
      ];

      (async () => {
        try {
          const res = await fetch(`${apiUrl}:${port}/api/v1/ruta`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
          const data = await res.json();
          const r0 = data?.routes?.[0];
          if (!r0) return;

          setRoutes(prev =>
            prev.map(r => r.id === rutaId ? { ...r, geometry: r0.geometry, distance: r0.distance } : r)
          );

          const nuevoResumen = calcularResumen({
            rutaId,
            puntos: ruta.puntos, // conserva el orden original de la ruta
            distancia: r0.distance || 0,
            duracionSegundos: r0.duration || 0
          });
          setResumenesCarga(prev => prev.map(rc => rc.id !== rutaId ? rc : { ...rc, ...nuevoResumen }));
        } catch (e) {
          console.error('Recalc con vias (ORS) falló', e);
        }
      })();
    });
  }, [viasByRoute, routes]);

  // === Guardar/Imprimir
  const handleImprimir = async (rutaId) => {
    const ruta     = routes.find(r => r.id === rutaId);
    const resumen  = resumenesCarga.find(r => r.id === rutaId);
    if (!ruta || !resumen) return;

    const coordsArray = polyline.decode(ruta.geometry);
    const geometria   = ruta.geometry;
    const waypointsResumen = resumen.puntos.map(waypoint => ({
      lat: waypoint.lat, lng: waypoint.lng, nombre: waypoint.nombre, pedidos: [waypoint.pedidos]
    }));
    const totalPedidos     = Array.isArray(resumen.pedidos) ? resumen.pedidos.length : 0;
    const pesoTotal        = resumen.totalPeso.toFixed(2);
    const distanciaKm      = (resumen.distancia / 1000).toFixed(2);
    const duracionH        = resumen.tiempo.toFixed(2);
    const porcentajeCarga  = resumen.totalPorcentaje.toFixed(2);
    const nombre           = obtenerNombrePorRutaId(resumen.id);

    const payload = {
      noruta: nombre,
      geometry: geometria,
      waypoints: waypointsResumen,
      pedidos: totalPedidos.toString(),
      peso:  parseFloat(pesoTotal),
      distancia: parseFloat(distanciaKm),
      tiempo: parseFloat(duracionH),
      porcentajeCarga: parseFloat(porcentajeCarga),
      orden: ruta.puntos.map((wp) => `<li>${wp.nombre ?? `${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}`}</li>`).join('')
    };

    const html = `<!DOCTYPE html>...`; // (deja tu HTML como lo tenías; omitido por brevedad)

    try {
      if (!modoEditar) {
        await axios.post(`${apiUrl}:${port}/api/v1/fetchRuta`, payload);
        eliminarRutaPorId(rutaId);
        mandarCorreo(payload);
        notify.success('Datos enviados. Abriendo impresión...', 2000);

        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const w    = window.open(url, '_blank');
        w?.addEventListener('load', () => URL.revokeObjectURL(url));
      } else {
        await axios.post(`${apiUrl}:${port}/api/v1/actualizarRuta`, payload);
        eliminarRutaPorId(rutaId);
        mandarCorreo(payload);
        notify.success('Datos actualizados. Enviándote al listado...', 2000);
      }
    } catch (err) {
      console.log(err);
      notify.error('Ocurrió un error al guardar/imprimir');
      return;
    } finally {
      setLoading(false);
    }
  };

  function eliminarRutaPorId(id) {
    setRoutes(prev => prev.filter(r => r.id !== id));
    setResumenesCarga(prev => prev.filter(r => r.id !== id));
    setWaypoints(prev => prev.filter(wp => wp.rutaId !== id));
  }

  const mandarCorreo = (ruta_data) =>{
    const payload = { to: 'lemuspablo300@gmail.com', subject: "Rutas planificadas", ruta_data };
    try { axios.post(`${apiUrl}:${port}/api/v1/mail/notifyVentas`, payload); }
    catch(err){ console.log(err); }
  };

  const handleEliminarPedido = (index) => {
    const rutaId = waypointSeleccionado?.rutaId;
    if (waypointSeleccionado.pedidos.length <= 1) {
      setDialogVisible(false);
      Swal.fire({
        title: 'Ups!', text: 'No puedes eliminar el último pedido. Debe quedar al menos uno.',
        icon: 'warning', confirmButtonText: 'Entendido', confirmButtonColor: '#10b981',
        background: '#0b0b10', color: '#e5ffe9'
      });
      return;
    }

    setWaypointSeleccionado(prev => {
      const nuevosPedidos = prev.pedidos.filter((_, i) => i !== index);
      return { ...prev, pedidos: nuevosPedidos };
    });

    setWaypoints(prevWaypoints => {
      const nuevosWaypoints = prevWaypoints.map(wp =>
        wp.id === waypointSeleccionado.id
          ? { ...wp, pedidos: wp.pedidos.filter((_, i) => i !== index) }
          : wp
      );

      if (rutaId) {
        const puntosRuta = nuevosWaypoints.filter(wp => wp.rutaId === rutaId);
        const nuevoResumen = calcularResumen({
          rutaId,
          puntos: puntosRuta,
          distancia: routes.find(r => r.id === rutaId)?.distance || 0,
          duracionSegundos: 0
        });
        setResumenesCarga(prev => prev.map(r =>
          r.id === rutaId ? { ...r, ...nuevoResumen } : r
        ));
      }
      return nuevosWaypoints;
    });
  };

  const handleDesvio = () => setModoDesvio(!modoDesvio);

  // === Guardar ruta desde modo edición
  const handleGuardarRuta = async () =>{
    await handleImprimir('ruta_temp_ls', { isUpdate: true });
    clearEditLS();
    setModoEditar(false);
    setSelectedView('ListadoDeRutasPlanificadas');
  };
  
  // ===================== RENDER =====================
  return (
  <div className="p-4 bg-[#0b0b10] text-emerald-50">
    <h2 className="text-2xl font-bold text-emerald-400 mb-3">
      Planificación y Optimización de Rutas
    </h2>

    {/* Controles superiores */}
    <div className="flex gap-4 mb-4 items-center justify-between rounded-xl border border-emerald-600/20 bg-[#0f1115] px-4 py-3 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
      {!modoEditar && (
        <Button
          label="Obtener pedidos pendientes"
          onClick={handleProcessClick}
          className="!bg-emerald-700 !text-white hover:!bg-emerald-600 !px-4 !py-2 !rounded-lg !border !border-emerald-500/40"
        />
      )}
      {modoEditar && (
        <div className="flex gap-3">
          <Button
            label="Guardar ruta"
            onClick={handleGuardarRuta}
            className="!bg-emerald-700 !text-white hover:!bg-emerald-600 !px-4 !py-2 !rounded-lg !border !border-emerald-500/40"
          />
          <Button
            label="Asignar un desvío"
            onClick={handleDesvio}
            className="!bg-emerald-700 !text-white hover:!bg-emerald-600 !px-4 !py-2 !rounded-lg !border !border-emerald-500/40"
          />
        </div>
      )}

      <Dropdown
        value={centroSeleccionado}
        options={opcionesCentros}
        onChange={e => setCentroSeleccionado(e.value)}
        placeholder="Centro de distribución"
        className="w-56 ml-auto !bg-[#0b0b10] !text-emerald-100 !border !border-emerald-600/30 rounded-lg"
        panelClassName="!bg-[#0f1115] !text-emerald-100 !border-emerald-600/30"
      />
    </div>

    {/* Layout principal */}
    <div className="flex gap-3" style={{ height: '900px' }}>
      <div className="sticky top-0 z-10 pb-2">
        <button
          className="rounded-lg bg-[#0f1115] text-emerald-300 border border-emerald-600/30 h-8 w-8 flex items-center justify-center hover:bg-[#12151c] transition"
          onClick={() => setAbrirSidePanel(!abrirSidePanel)}
          title={abrirSidePanel ? 'Ocultar panel' : 'Mostrar panel'}
        >
          ➜
        </button>
      </div>

      {/* Sidebar rutas */}
      <div
        className={`overflow-y-auto transition-all duration-300 ease-in-out ${
          abrirSidePanel ? 'w-72 p-4' : 'w-0 p-0'
        } rounded-xl border border-emerald-600/20 bg-[#0f1115]`}
      >
        {abrirSidePanel &&
          routes.map((ruta, idx) => (
            <div
              key={ruta.id}
              className="mb-4 rounded-lg border border-emerald-600/20 bg-[#0b0f14] p-3 shadow-[0_0_0_1px_rgba(16,185,129,0.05)]"
            >
              <div
                onClick={() => toggleRuta(idx)}
                className="flex justify-between items-center cursor-pointer"
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  Ruta #{ruta.name} – {ruta.centerName}
                  <span
                    style={{ width: 16, height: 16, backgroundColor: ruta.color }}
                    className="inline-block rounded border border-emerald-600/30"
                  />
                </h3>
                <button className="px-2 py-0.5 text-xs rounded-full bg-[#0f1115] text-emerald-300 border border-emerald-600/30 hover:bg-[#12151c]">
                  {rutasAbiertas[idx] ? 'Ocultar' : 'Ver'}
                </button>
              </div>

              {rutasAbiertas[idx] && (
                <div className="mt-3">
                  <div className="flex items-center mb-2 text-emerald-200">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2" />
                    <span className="text-sm font-medium">
                      Inicio: CEDIS {ruta.centerName}
                    </span>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={e => handleDragEnd(e, ruta.id)}
                  >
                    <SortableContext
                      
                      items={ruta.puntos.map(wp => wp.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1 ">
                        
                        {ruta.puntos.map((wp, i) => (
                          <SortableItem
                            
                            key={wp.id}
                            id={wp.id}
                            nombre={
                              <div className="whitespace-normal break-all max-w-[230px] overflow-hidden text-emerald-100">
                                {i + 1}. {wp.nombre}
                              </div>
                            }
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>

                  <div className="flex items-center mb-3 mt-3 text-emerald-200">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2" />
                    <span className="text-sm font-medium">
                      Fin: CEDIS {ruta.centerName}
                    </span>
                  </div>
                  <Button
                    className="!bg-emerald-700 !text-white hover:!bg-emerald-600 !border !border-emerald-500/40 !px-3 !py-2 !rounded-lg"
                    onClick={() => handleReoptimize(ruta)}
                  >
                    Re optimizar
                  </Button>
                </div>
              )}
            </div>
          ))}

        {abrirSidePanel && routes.length === 0 && (
          <p className="text-sm text-emerald-300/70">No hay rutas para mostrar</p>
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Resúmenes */}
        <div
          className={`w-full overflow-x-auto overflow-y-hidden transition-all duration-300 ease-in-out ${
            resumenesCarga?.length > 0 ? 'min-h-[200px]' : 'min-h-0'
          }`}
        >
          <div className="flex flex-nowrap gap-4 p-3">
            {Array.isArray(resumenesCarga) &&
              resumenesCarga.map((resumen, i) => (
                <div key={i} className="flex-shrink-0 w-80">
                  <div className="rounded-lg border border-emerald-600/20 bg-[#0f1115] p-4 min-h-[180px] flex flex-col justify-between shadow-[0_0_0_1px_rgba(16,185,129,0.05)]">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-emerald-200">
                        Ruta #{obtenerNombrePorRutaId(resumen.id)}
                      </h3>
                    </div>

                    <div className="text-sm space-y-1 text-emerald-100/90">
                      <p>
                        <strong className="text-emerald-300">Total de pedidos:</strong>{' '}
                        {resumen.pedidos.length}
                      </p>
                      <p>
                        <strong className="text-emerald-300">Peso total:</strong>{' '}
                        {resumen.totalPeso.toFixed(2)} kg
                      </p>
                      <p>
                        <strong className="text-emerald-300">% de carga:</strong>{' '}
                        {resumen.totalPorcentaje}%
                      </p>
                      <p>
                        <strong className="text-emerald-300">Distancia:</strong>{' '}
                        {(resumen.distancia / 1000).toFixed(2)} km
                      </p>
                      <p>
                        <strong className="text-emerald-300">Tiempo total:</strong>{' '}
                        {resumen.tiempo.toFixed(2)} h
                      </p>

                      <div
                        className="rounded border border-emerald-600/40"
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: obtenerColorPorRutaId(resumen.id),
                        }}
                      />

                      {!modoEditar && (
                        <Button
                          className="!bg-emerald-700 !text-white !p-2 !rounded-lg !border !border-emerald-500/40 hover:!bg-emerald-600"
                          onClick={() => setImprimirDialogV(true)}
                        >
                          Guardar ruta
                        </Button>
                      )}

                      <Dialog
                        header={
                          <div className="flex items-center gap-2 text-emerald-100">
                            <span className="font-semibold">Guardar ruta</span>
                          </div>
                        }
                        visible={imprimirDialogV}
                        style={{ width: '36rem' }}
                        modal
                        className="!bg-[#0b0b10] !text-emerald-50"
                        headerStyle={{ background: '#0f1115', color: '#e5ffe9' }}
                        contentStyle={{ background: '#0b0b10', color: '#e5ffe9' }}
                        onHide={() => {
                          if (!imprimirDialogV) return;
                          setImprimirDialogV(false);
                        }}
                      >
                        <div className="space-y-5">
                          <div className="rounded-2xl border border-emerald-600/20 p-4 bg-[#0f1115] text-emerald-100">
                            Estás a punto de guardar la ruta.
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <section className="rounded-2xl border border-emerald-600/20 bg-[#0f1115] p-4">
                              <Button
                                className="w-full !rounded-xl !px-3 !py-2 text-sm font-medium !bg-emerald-700 hover:!bg-emerald-600 !border !border-emerald-500/40"
                                label="Continuar"
                                onClick={() => {
                                  handleImprimir(resumen.id);
                                  setImprimirDialogV(false);
                                }}
                              />
                            </section>
                            <section className="rounded-2xl border border-emerald-600/20 bg-[#0f1115] p-4">
                              <Button
                                className="w-full !rounded-xl !px-3 !py-2 text-sm font-medium !bg-transparent !text-emerald-200 !border !border-emerald-600/40 hover:!bg-[#12151c]"
                                outlined
                                label="Regresar"
                                onClick={() => setImprimirDialogV(false)}
                              />
                            </section>
                          </div>
                        </div>
                      </Dialog>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 relative min-h-[600px] rounded-xl border border-emerald-600/20 bg-[#0b0f14]">
          <DynamicMap
            key={mapKey}
            waypoints_con_nombre={waypoints}
            routes={routes}
            selection={currentSelection}
            onFinishDraw={handleSelectWaypoints}
            onSelectWaypoints={handleSelectWaypoints}
            onRemoveWaypoints={handleRemoveWaypoints}
            distributionCenter={centrosDistribucion[centroSeleccionado]}
            onClickWaypoint={handleWaypointClick}
            setWaypoints={setWaypoints}
            setMapInstance={map => {
              mapRef.current = map;
            }}
            isEditMode={modoEditar}
            isDesvioMode={modoDesvio}
            editRouteId="ruta_temp_ls"
            editRouteName={routes.find(r => r.id === 'ruta_temp_ls')?.name ?? 'TEMP'}
            viaWaypoints={viaWaypoints}
            setViaWaypoints={setViaWaypoints}
            getVias={getVias}
            onAddVia={onAddVia}
            onMoveVia={onMoveVia}
            onDeleteVia={onDeleteVia}
          />

          <Dialog
  header={
    <div className="flex items-center gap-2 text-emerald-100">
      <span className="font-semibold">Detalles de la dirección</span>
    </div>
  }
  visible={dialogVisible}
  style={{ width: '600px' }}
  modal
  className="!bg-[#0b0b10] !text-emerald-50"
  headerStyle={{ background: '#0f1115', color: '#e5ffe9' }}
  contentStyle={{ background: '#0b0b10', color: '#e5ffe9' }}
  onHide={() => {
    setDialogVisible(false);
    setMostrarDropdown(false);
    setRutaSeleccionada(null);
  }}
>
  {waypointSeleccionado ? (
    <div className="space-y-5">
      {/* INFO PRINCIPAL */}
      <div className="rounded-2xl border border-emerald-600/20 p-4 bg-[#0f1115]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-emerald-100/90">
          <p>
            <b className="text-emerald-300">Nombre Cliente:</b>{' '}
            {waypointSeleccionado?.pedidos?.[0]?.['Nombre Cliente'] ?? '—'}
          </p>
          <p>
            <b className="text-emerald-300">Dirección:</b>{' '}
            {waypointSeleccionado?.nombre ?? '—'}
          </p>
          <p className="sm:col-span-2">
            <b className="text-emerald-300">Coordenadas:</b>{' '}
            Lat {waypointSeleccionado.lat} / Lng {waypointSeleccionado.lng}
          </p>
        </div>
      </div>

      {/* PEDIDOS LISTA */}
      <div className="rounded-2xl border border-emerald-600/20 p-4 bg-[#0f1115]">
        <h4 className="font-semibold text-sm text-emerald-200 mb-3">
          Pedidos asociados
        </h4>

        {Array.isArray(waypointSeleccionado.pedidos) &&
        waypointSeleccionado.pedidos.length > 0 ? (
          <ul className="space-y-2">
            {waypointSeleccionado.pedidos.map((p, i) => (
              <li
                key={i}
                className="rounded-xl border border-emerald-600/20 p-3 bg-[#0b0f14]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-emerald-100">
                    <b className="text-emerald-300">#{p.Pedido}</b>{' '}
                    – {p['Cantidad Articulo']} {p.Articulo} – {p.Peso} kg –{' '}
                    {p.PorcentajeCarga}%
                  </span>
                  <button
                    onClick={() => handleEliminarPedido(i)}
                    className="shrink-0 inline-flex items-center justify-center rounded-lg p-1.5 text-red-400 hover:bg-red-900/20 transition"
                    title={`Eliminar pedido ${p.Pedido}`}
                    aria-label={`Eliminar pedido ${p.Pedido}`}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 text-xs">
                  <div className="text-[11px] uppercase text-emerald-300/70">
                    Comentarios
                  </div>
                  <p className="text-emerald-100/90">
                    {p.Comentarios ? p.Comentarios : 'No hay comentarios'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-emerald-300/70">
            Este waypoint no tiene pedidos.
          </div>
        )}

        {/* STATS COMPATOS */}
        {Array.isArray(waypointSeleccionado.pedidos) &&
          waypointSeleccionado.pedidos.length > 0 && (() => {
            const pesoTotal = waypointSeleccionado.pedidos.reduce(
              (acc, p) => acc + (p.Peso || 0),
              0
            );
            const porcentajeTotal = waypointSeleccionado.pedidos.reduce(
              (acc, p) => acc + (p.PorcentajeCarga || 0),
              0
            );
            const fecha = waypointSeleccionado.pedidos?.[0]?.FechaEntrega ?? '—';
            return (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-600/20 bg-[#0b0f14] p-3 text-center">
                  <div className="text-[11px] uppercase text-emerald-300/70">
                    Peso total
                  </div>
                  <div className="text-sm font-semibold text-emerald-100">
                    {pesoTotal.toFixed(2)} kg
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-600/20 bg-[#0b0f14] p-3 text-center">
                  <div className="text-[11px] uppercase text-emerald-300/70">
                    % carga total
                  </div>
                  <div className="text-sm font-semibold text-emerald-100">
                    {porcentajeTotal.toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-600/20 bg-[#0b0f14] p-3 text-center">
                  <div className="text-[11px] uppercase text-emerald-300/70">
                    Fecha de pedido
                  </div>
                  <div className="text-sm font-semibold text-emerald-100">
                    {fecha}
                  </div>
                </div>
              </div>
            );
          })()}
      </div>

      {/* ACCIONES: REASIGNAR / REMOVER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* REASIGNAR */}
        <section className="rounded-2xl border border-emerald-600/20 p-4 bg-[#0f1115]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-emerald-300 font-semibold text-sm">
              Reasignar a otra ruta
            </span>
          </div>

          <button
            className="w-full inline-flex items-center justify-center rounded-xl border border-emerald-600/30 bg-[#0b0b10] px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-[#12151c] transition"
            onClick={() => setMostrarDropdown(v => !v)}
          >
            {mostrarDropdown ? 'Cancelar' : 'Reasignar a ruta'}
          </button>

          {mostrarDropdown && (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-emerald-600/30 p-2 bg-[#0b0f14]">
                <Dropdown
                  value={rutaSeleccionada}
                  options={routes.map(r => ({
                    label: `Ruta #${r.name}`,
                    value: r.id,
                    color: r.color
                  }))}
                  onChange={(e) => setRutaSeleccionada(e.value)}
                  placeholder="Selecciona una ruta"
                  className="w-full !bg-[#0b0b10] !text-emerald-100 !border !border-emerald-600/30 rounded-lg"
                  panelClassName="!bg-[#0f1115] !text-emerald-100 !border-emerald-600/30"
                  itemTemplate={(option) => (
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: option.color
                        }}
                        className="inline-block rounded border border-emerald-600/30"
                      />
                      <span>{option.label}</span>
                    </div>
                  )}
                />
              </div>

              <button
                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                disabled={!rutaSeleccionada}
                onClick={() => {
                  handleAssignWaypoint(waypointSeleccionado, rutaSeleccionada);
                  setMostrarDropdown(false);
                  setRutaSeleccionada(null);
                  setDialogVisible(false);
                }}
              >
                Confirmar asignación
              </button>
            </div>
          )}
        </section>

        {/* REMOVER DE LA RUTA */}
        <section className="rounded-2xl border border-emerald-600/20 p-4 bg-[#0f1115]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 font-semibold text-sm">
              Remover de esta ruta
            </span>
          </div>
          <p className="text-xs text-emerald-300/70 mb-3">
            Solo desasigna la dirección de la ruta. No borra los pedidos.
          </p>

          <button
            className="w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
            onClick={() => {
              handleUnassignWaypoint(waypointSeleccionado);
              setDialogVisible(false);
              setMostrarDropdown(false);
              setRutaSeleccionada(null);
            }}
          >
            Remover de ruta
          </button>
        </section>
      </div>
    </div>
  ) : (
    <div className="text-emerald-200">No hay detalles disponibles.</div>
  )}
</Dialog>

        </div>
      </div>
    </div>
  </div>
);

};

export default PlanificacionRutas;
