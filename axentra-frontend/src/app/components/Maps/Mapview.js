import axios from 'axios';
import L from 'leaflet';
if (typeof window !== 'undefined') {
  window.L = L;
  require('@geoman-io/leaflet-geoman-free');
}

import '@geoman-io/leaflet-geoman-free';
import polyline from '@mapbox/polyline';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap
} from 'react-leaflet';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid';
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const port = process.env.NEXT_PUBLIC_PORT_API;
const colores = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000'
];

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function showLoadingSwal(mensaje = 'Procesando...') {
  Swal.fire({
    title: mensaje,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

async function askRouteNumber(defaultNumber) {
  const { value: routeNumber } = await Swal.fire({
  title: 'Asignar número de ruta',
  input: 'number',
  inputLabel: 'Solo dígitos',
  inputValue: defaultNumber,
  inputAttributes: {
    min: 1,
    step: 1,
    inputmode: 'numeric' // móvil: teclado numérico
  },
  showCancelButton: true,
  confirmButtonText: 'Aceptar',
  cancelButtonText: 'Cancelar',
  allowOutsideClick: false,

  // 🎨 Tema negro + esmeralda
  background: '#0b0b10',
  color: '#e5ffe9',
  buttonsStyling: false, // usamos nuestras clases
  customClass: {
    popup: 'rounded-2xl border border-emerald-600/30 shadow-xl',
    title: 'text-emerald-300',
    confirmButton:
      'px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white ' +
      'border border-emerald-500/40 transition',
    cancelButton:
      'ml-2 px-4 py-2 rounded-lg bg-transparent text-emerald-200 ' +
      'border border-emerald-600/40 hover:bg-[#12151c] transition',
    input: 'bg-[#0f1115] text-emerald-100 border border-emerald-600/30 rounded-lg'
  },

  didOpen: (el) => {
    // estiliza el label del input (SweetAlert no trae customClass para el label)
    const label = el.querySelector('.swal2-input-label');
    if (label) {
      label.style.color = '#a7f3d0'; // emerald-200
      label.style.marginBottom = '6px';
      label.style.display = 'inline-block';
    }
    const input = el.querySelector('.swal2-input');
    if (input) {
      input.style.background = '#0f1115';
      input.style.color = '#e5ffe9';
      input.style.border = '1px solid rgba(16,185,129,0.3)';
      input.style.outline = 'none';
      input.style.boxShadow = 'none';
    }
  },

  inputValidator: (value) => {
    if (!value) return 'Debes ingresar un número';
    if (!/^\d+$/.test(String(value))) return 'Solo se permiten dígitos';
    if (Number(value) < 1) return 'Debe ser 1 o mayor';
    return undefined;
  },

  // opcional: devolver número ya parseado
  preConfirm: (value) => Number(value)
});


  if (routeNumber) {
    console.log('Número de ruta:', routeNumber);
    return routeNumber;
  }
  return null;
}

function LassoTool({ waypoints, setWaypoints, routesCount, onSelect, onRemove, distributionCenter, isDesvioMode = false, isEditMode = false, editRouteId = 'ruta_temp_ls',
  editRouteName = 'TEMP', routes }) {
 
  const map = useMap();

  useEffect(() => {

    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawMarker: false,
      drawRectangle: false,
      drawPolyline: false,
      drawCircleMarker: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
      drawPolygon: true,
    });


    map.pm.setGlobalOptions({
     hideMiddleMarkers:true,
      snappable: false,
      removable: false,
      snapDistance: 0,
      hintlineStyle: { color: '#4f46e5', dashArray: '4,4' },
      templineStyle: { color: '#4f46e5', dashArray: '4,4' },
      pathOptions: { color: '#4f46e5', fillOpacity: 0.2 },
    });

    
    const handleCreate = async (e) => {
  const polygonLayer = e.layer;
  if (polygonLayer._processedByLasso) return;
  polygonLayer._processedByLasso = true;

  // color: si estamos editando, toma el color de la ruta en edición si existe
  const editRoute = routes.find(r => r.id === editRouteId);
  const colorBase = colores[routesCount % colores.length];
  const color = isEditMode
    ? (editRoute?.color ?? colorBase)
    : colorBase;

  polygonLayer.setStyle({ color });
  polygonLayer._rutaColor = color;

  polygonLayer.pm.enable({ 
    allowSelfIntersection: true,
    snapMiddleMarkers: false,
    midpoints: false 
   });
  polygonLayer.pm.setOptions({ removable: true });

  // nombre/numero de ruta
  let customName;
  let id;

  if (isEditMode) {
    // 👇 sin prompt: reusa la ruta del LS
    id = editRouteId;
    customName = editRouteName;
  } else {
    const defaultNumber = `${routesCount + 1}`;
    const answer = await askRouteNumber(defaultNumber); // <- tu prompt actual
    if (!answer) {
      // si cancelan, elimina el polígono y aborta
      polygonLayer.remove();
      return;
    }
    customName = String(answer);
    id = uuidv4();
  }

  // tooltip seguro (tu código tenía customName.instance, que no existe)
  polygonLayer.bindTooltip(String(customName), {
    direction: 'center',
    offset: [0, 0],
    sticky: true,
    opacity: 0.9,
  });
  polygonLayer.on('mouseover', () => polygonLayer.openTooltip());
  polygonLayer.on('mouseout', () => polygonLayer.closeTooltip());

  // selección por polígono
  const geo = polygonLayer.toGeoJSON();
  const seleccion = waypoints.filter(wp =>
    booleanPointInPolygon([wp.lng, wp.lat], geo)
  );

  // asigna rutaId a los seleccionados (si edit, los suma a esa ruta)
  setWaypoints(prev =>
    prev.map(wp =>
      seleccion.some(s => s.lat === wp.lat && s.lng === wp.lng)
        ? { ...wp, rutaId: id }
        : wp
    )
  );

  polygonLayer.options.customId = id;
  polygonLayer.options.customName = customName;

  // 👇 Llama al padre. En modo edición, tu padre ya hace mergeIntoEditRoute
  onSelect({ waypoints: seleccion, color, id, name: customName });

  // --- edición del polígono ---
map.on('pm:globalremovalmodetoggled', (e) => {
  if (e.enabled) {
    map.eachLayer(l => l?.pm?.disable && l.pm.disable());
  } else {
    // Cuando salgo del borrador: vuelvo a poner edición con tus opciones
    map.eachLayer(l => {
      if (l?.pm && l instanceof L.Polygon) {
        l.pm.enable({
          allowSelfIntersection: true,
          snapMiddleMarkers: false,
          hideMiddleMarkers: true,
        });
      }
    });
  }
});


  polygonLayer.on('pm:edit', async () => {
    showLoadingSwal('Optimizando ruta...');

    const updatedGeo = polygonLayer.toGeoJSON();
    const id = polygonLayer.options.customId;
    const color = polygonLayer.options.color || colores[routesCount % colores.length];
    const name  = polygonLayer.options.customName;

    const updatedSeleccion = waypoints.filter(wp =>
      booleanPointInPolygon([wp.lng, wp.lat], updatedGeo)
    );

    setWaypoints(prev =>
      prev.map(wp => {
        const dentro = updatedSeleccion.some(s => s.lat === wp.lat && s.lng === wp.lng);
        if (dentro) return { ...wp, rutaId: id };
        // si el wp estaba en esta ruta y ya no está dentro, lo desasignamos
        if (wp.rutaId === id && !dentro) return { ...wp, rutaId: null };
        return wp;
      })
    );

    if (!distributionCenter || updatedSeleccion.length < 1) {
      Swal.close();
      return;
    }


    

    const payload = [
      { lat: distributionCenter.lat, lng: distributionCenter.lng },
      ...updatedSeleccion,
      // si quieres cerrar circuito, agrega también el DC al final:
      // { lat: distributionCenter.lat, lng: distributionCenter.lng },
    ];

    try {
      const res = await axios.post(`${apiUrl}:${port}/api/v1/rutanopti`,
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = res.data;
      const geometry = data?.routes?.[0]?.geometry;
      const distance = data?.routes?.[0]?.distance || 0;
      const steps    = data?.routes?.[0]?.steps || [];

      const orderedWaypoints = steps
        .filter(s => s.type === 'job')
        .map(s => {
          const [lng, lat] = s.location;
          return updatedSeleccion.find(wp =>
            Math.abs(wp.lat - lat) < 1e-6 &&
            Math.abs(wp.lng - lng) < 1e-6
          );
        })
        .filter(Boolean);

      await onSelect({
        waypoints: orderedWaypoints,
        color,
        id,
        name,
        geometry,
        distance
      });

    } catch (err) {
      console.error("Error en llamada a /rutanopti:", err);
    } finally {
      Swal.close();
    }
  });
};



   
    
   

    const handleRemove = e => {
      const geo = e.layer.toGeoJSON();
      const seleccion = waypoints.filter(wp =>
        booleanPointInPolygon([wp.lng, wp.lat], geo)
      );
      onRemove(seleccion);
    };

    map.on('pm:create', handleCreate);
    map.on('pm:remove', handleRemove);

    return () => {
      map.off('pm:create', handleCreate);
      map.off('pm:remove', handleRemove);
    };
  }, [map, waypoints, setWaypoints, onSelect, onRemove, routesCount, distributionCenter]);

  return null;
}

function MapSetter({ setMapInstance }) {
  const map = useMap();
  useEffect(() => {
    console.log('Anclado al mapa', map);
    setMapInstance(map);
  }, [map, setMapInstance]);
  return null;
}


const MapView = ({
  waypoints_con_nombre = [],
  routes = [],
  onSelectWaypoints,
  onRemoveWaypoints,
  distributionCenter,
  onClickWaypoint,
  setWaypoints,
  setMapInstance,
   isEditMode = false,
  editRouteId = 'ruta_temp_ls',
  editRouteName = 'TEMP',
  getVias = () => [],
  onAddVia = () => {},
  onMoveVia = () => {},
  onDeleteVia = () => {},
}) => {
    const [colorVisible, setColorVisible] = useState(false)
  const mapRef = useRef(null);        // ✅ aquí
  const dragSessionRef = useRef({
  active: false,
  marker: null,
  moveFn: null,
  upFn: null,
  rutaId: null
});

function beginLineDrag(rutaId, startLatLng, mapFromEvent) {
  const map = mapFromEvent || mapRef.current;
  if (!map) return;

  // si quedó colgada una sesión, limpiala
  forceResetDragSession(map);

  map.dragging.disable();
  map.getContainer().style.cursor = 'grabbing';

  const handle = L.marker(startLatLng, {
    interactive: false,
    zIndexOffset: 1000,
    icon: L.divIcon({
      className: 'via-handle',
      html: `<div style="width:18px;height:18px;border-radius:50%;
              background:#ffd700;border:2px solid #222;
              box-shadow:0 0 6px rgba(0,0,0,.4);pointer-events:none;"></div>`
    })
  }).addTo(map);

  // guardamos último latlng
  let lastLatLng = startLatLng;
  let cleaned = false;

  const moveFn = (e) => {
    if (e.latlng) {
      lastLatLng = e.latlng;
      handle.setLatLng(e.latlng);
    }
  };
  const onLeave = () => {
  // si salió del mapa con el botón abajo, garantizamos que un mouseup global cierre
  window.addEventListener('mouseup', upOnWindow, { once: true });
};

const watchdog = setTimeout(() => {
  if (dragSessionRef.current.active) {
    console.warn('limpiando drag colgado');
    cleanup();
  }
}, 10000); 
  const cleanup = () => {
     if (cleaned) return;
  cleaned = true;
  try { map.off('mousemove', moveFn); } catch {}
  try { map.off('mouseup', upOnMap); } catch {}
  try { window.removeEventListener('mouseup', upOnWindow); } catch {}
  try { container.removeEventListener('mouseleave', onLeave); } catch {}
  try { clearTimeout(watchdog); } catch {}
  try { map.removeLayer(handle); } catch {}
  map.dragging.enable();
  dragSessionRef.current = { active:false, marker:null, moveFn:null, upFn:null, rutaId:null };
  }
  const finishDrop = (latlng) => {
    if (!latlng) latlng = lastLatLng;     // fallback seguro
    if (!latlng) { cleanup(); return; }   // si aún no hay, aborta sin romper
    console.log('DROP en', latlng);
    onAddVia?.(rutaId, latlng);
    cleanup();
  };

  // mouseup desde el MAP trae e.latlng
  const upOnMap = (e) => finishDrop(e.latlng);

  // mouseup fuera del mapa: usamos el último latlng conocido
  const upOnWindow = () => finishDrop(lastLatLng);

  map.on('mousemove', moveFn);
  map.on('mouseup', upOnMap);
  window.addEventListener('mouseup', upOnWindow, { once: true });

  dragSessionRef.current = { active:true, marker:handle, moveFn, upFn:upOnMap, rutaId };
}

function forceResetDragSession(map){
  const ds = dragSessionRef.current;
  if (!ds.active) return;
  try { ds.moveFn && map.off('mousemove', ds.moveFn); } catch {}
  try { ds.upFn   && map.off('mouseup',   ds.upFn);   } catch {}
  try { ds.marker && map.hasLayer(ds.marker) && map.removeLayer(ds.marker); } catch {}
  map?.dragging?.enable?.();
  map?.getContainer?.().style && (map.getContainer().style.cursor = '');
  dragSessionRef.current = { active:false, marker:null, moveFn:null, upFn:null, rutaId:null };
}

useEffect(() => {
  const map = mapRef.current;
  if (!map) return;

  const cancelDrag = () => forceResetDragSession(map);

  // Cualquier toggle global de Geoman cancela el drag fantasma
  map.on('pm:globaldrawmodetoggled', cancelDrag);
  map.on('pm:globaleditmodetoggled', cancelDrag);
  map.on('pm:globalremovalmodetoggled', cancelDrag);

  // Esc para abortar
  const onEsc = (e) => { if (e.key === 'Escape') cancelDrag(); };
  window.addEventListener('keydown', onEsc);

  // Por si el cursor sale de la ventana y vuelve sin mouseup
  const onBlur = () => cancelDrag();
  window.addEventListener('blur', onBlur);

  return () => {
    map.off('pm:globaldrawmodetoggled', cancelDrag);
    map.off('pm:globaleditmodetoggled', cancelDrag);
    map.off('pm:globalremovalmodetoggled', cancelDrag);
    window.removeEventListener('keydown', onEsc);
    window.removeEventListener('blur', onBlur);
  };
}, []);


// --- helpers para matchear por proximidad ---
function distMeters(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat/2)**2 +
            Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Reordena puntos originales usando los steps devueltos.
// Empareja cada step con el punto MÁS CERCANO si está dentro del umbral (30m por defecto).
// Cualquier punto que no matchee se CONSERVA al final en el mismo orden original.
function orderByStepsRobusto(steps, puntosOriginales, umbral = 30) {
  const usados = new Set();
  const ordered = [];

  for (const s of (steps || [])) {
    if (s.type !== 'job' || !Array.isArray(s.location)) continue;
    const [lng, lat] = s.location;
    const target = { lat, lng };

    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < puntosOriginales.length; i++) {
      if (usados.has(i)) continue;
      const cand = puntosOriginales[i];
      const d = distMeters({ lat: cand.lat, lng: cand.lng }, target);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx !== -1 && bestDist <= umbral) {
      usados.add(bestIdx);
      ordered.push(puntosOriginales[bestIdx]);
    }
  }

  // Conserva los que no matchearon, en su orden original
  for (let i = 0; i < puntosOriginales.length; i++) {
    if (!usados.has(i)) ordered.push(puntosOriginales[i]);
  }

  return ordered.length ? ordered : puntosOriginales.slice();
}


  const uniqueCenters = [];
  routes.forEach(({ center, centerName }) => {
    if (center && !uniqueCenters.some(u => u.lat === center.lat && u.lng === center.lng)) {
      uniqueCenters.push({ lat: center.lat, lng: center.lng, name: centerName });
    }
  });

  const decoded = routes[0]?.geometry
    ? polyline.decode(routes[0].geometry).map(([lat, lng]) => [lat, lng])
    : null;
  
  const positions = decoded || waypoints_con_nombre.map(wp => [wp.lat, wp.lng]);
    console.log('Se actualizo el mapa');

  return (
    <MapContainer
    
      center={[17.5, -93.0]}
      zoom={8}
      scrollWheelZoom={true}
      doubleClickZoom={false}
      zoomControl={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={true}
      style={{ height: '100%', width: '100%' }}
      whenCreated={map => {
        setMapInstance(map);
        mapRef.current = map;
      }}
      
    >
      <MapSetter setMapInstance={setMapInstance} />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        crossOrigin={true}
      />

    

      {waypoints_con_nombre.map((wp, i) => (
        <CircleMarker
        pmIgnore={true}
          key={i}
          center={[wp.lat, wp.lng]}
          pathOptions={{
   color: wp.pedidos?.some(p => p.Comentarios === null || p.Comentarios === '') ? '#457b9d' : '#fa00b3',
fillColor: wp.pedidos?.some(p => p.Comentarios === null || p.Comentarios === '') ? '#a8dadc' : '#cf7ab6'

  }}
          radius={6}
          pane="markerPane"
           eventHandlers={{
      click: () => {
        
          onClickWaypoint(wp); 
        
      }
    }}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {wp.nombre}
           {wp.pedidos && wp.pedidos.length > 0 && (() => {
  const total = wp.pedidos.reduce(
    (acc, p) => {
      acc.peso += p.Peso || 0;
      acc.porcentaje += p.PorcentajeCarga || 0;
      return acc;
    },
    { peso: 0, porcentaje: 0 }
  );


  const obtenerColorPorRutaId = (id) => {
  const ruta = routes.find(r => r.id === id);
  return ruta?.color 
};

const color = obtenerColorPorRutaId(wp.rutaId);
const tieneRutaAsignada = !!color;


           

  return (
   <Tooltip
  direction="top"
  offset={[0, -12]}
  opacity={1}
  sticky
  className="!p-0 !bg-transparent !border-0"
>
  <div className="rounded-2xl border border-gray-200 bg-white/95 shadow-xl px-3 py-2 min-w-[220px]">
    {/* Título compacto */}
    <div className="mb-2 flex items-center gap-2">
      <i className="pi pi-info-circle text-blue-600 text-sm" />
      <span className="text-[12px] font-semibold text-gray-800">Resumen del waypoint</span>
    </div>

    {/* Datos en grid */}
    <div className="grid grid-cols-1 gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-gray-500">Peso</span>
        <span className="font-medium text-gray-800">{total.peso} kg</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-gray-500">% carga</span>
        <span className="font-medium text-gray-800">{(total.porcentaje).toFixed(3)}%</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-gray-500">Fecha de pedido</span>
        <span className="font-medium text-gray-800">{wp.pedidos[0].FechaEntrega}</span>
      </div>
    </div>

    {/* Estado de ruta + color */}
    <div className="mt-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {tieneRutaAsignada ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[4px] border border-white/60 shadow"
              style={{ backgroundColor: obtenerColorPorRutaId(wp.rutaId) }}
            />
            Asignada a ruta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            Sin asignar
          </span>
        )}
      </div>

      
    </div>
  </div>
</Tooltip>

  );
})()}

          </Tooltip>
        </CircleMarker>
      ))}

      {uniqueCenters.map((c, idx) => (
        <Marker key={`center-${idx}`} position={[c.lat, c.lng]} icon={greenIcon}>
          <Tooltip direction="top" offset={[0, -10]}>
            {c.name}
          </Tooltip>
        </Marker>
      ))}

      <LassoTool
       waypoints={waypoints_con_nombre}
  routes={routes}                 
  routesCount={routes.length}
  onSelect={onSelectWaypoints}
  onRemove={onRemoveWaypoints}
  setWaypoints={setWaypoints}
  distributionCenter={distributionCenter}
  isEditMode={isEditMode}         
  editRouteId={editRouteId}       
  editRouteName={editRouteName}   
      />

      {routes.map((rutaObj, idx) => {
        const coords = polyline.decode(rutaObj.geometry).map(([lat, lng]) => [lat, lng]);
        const color = colores[idx % colores.length];
        return (
          <Polyline
           key={`${rutaObj.id}-${rutaObj.geometry}`}
  positions={coords}
  pathOptions={{ color, weight: 8}}
  interactive
  bubblingMouseEvents={false}
  eventHandlers={{
    mousedown: (e) => {
      console.log('MOUSEDOWN en línea', rutaObj.id, e.latlng);
      e.originalEvent?.preventDefault?.();
      e.originalEvent?.stopPropagation?.();
      const mapFromEvent = e?.target?._map || e?.sourceTarget?._map;
      beginLineDrag(rutaObj.id, e.latlng, mapFromEvent);
    }
  }}
          />
        );
      })}


      {routes.map((r) => (getVias?.(r.id) || []).map((vw, i) => (
  <Marker
    key={`via-${r.id}-${i}`}
    position={[vw.lat, vw.lng]}
    draggable={true}
    pmIgnore={true}
    icon={L.divIcon({
      className: 'via-pin',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#ffa500;border:2px solid #000"></div>'
    })}
    eventHandlers={{
      dragend: (e) => onMoveVia?.(r.id, i, e.target.getLatLng()),
      contextmenu: () => onDeleteVia?.(r.id, i),
    }}
  />
)))}
    </MapContainer>
  );
};

export default MapView;