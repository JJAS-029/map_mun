// =========================================================
// --- 1. CONFIGURACIÓN INICIAL ---
// =========================================================
const CONFIG = {
    centroInicial: [19.4326, -99.1332],
    zoomInicial: 9,
    zoomEtiquetasMun: 10,
    zoomParaColonias: 11, 
    zoomParaPildoras: 13, // <--- Nuevo: Nivel de zoom para mostrar las bolitas flotantes
    passCorrecto: "2026_SS12"
};

// DICCIONARIO DE MÉTRICAS (Orden estricto, colores y textos de metodología)
const METRICAS = [
    { id: 'INCIDENCIA', nombre: 'Incidencia delictiva', color: '#bf9000', texto: 'Aquí va la explicación metodológica sobre cómo se calculan las carpetas de investigación y los índices delictivos para esta variable...' },
    { id: 'DO', nombre: 'Delincuencia Organizada', color: '#7030a0', texto: 'Descripción de los factores de riesgo asociados a crímenes de alto impacto, cárteles y violencia sistemática...' },
    { id: 'POB_VIAL', nombre: 'Población y vialidades', color: '#92deba', texto: 'Suma de los índices de densidad poblacional cruzados con la conectividad de la red vial principal y secundaria...' },
    { id: 'CONF_SOC', nombre: 'Conflictividad social', color: '#cc3399', texto: 'Detalles sobre factores de descomposición social, manifestaciones, riñas y reportes ciudadanos...' },
    { id: 'CARAC_FIS', nombre: 'Características físicas', color: '#00b0f0', texto: 'Evaluación del entorno urbano: alumbrado público, lotes baldíos, estado de las banquetas y espacios recuperados...' },
    { id: 'UNID_ECO', nombre: 'Unidades económicas', color: '#0f395f', texto: 'Análisis de la densidad comercial, giros negros y vulnerabilidad de negocios ante la extorsión...' }
];

// FUNCIÓN PARA EL SEMÁFORO DEL POLÍGONO
function getColorPondera(valor) {
    switch(valor) {
        case 'Prioritaria': return '#fe0000';
        case 'Alta': return '#ffaa01';
        case 'Media': return '#ffff00';
        case 'Baja': return '#b4d79d';
        default: return null; // Para nulos, vacíos o ceros
    }
}

function verificarPassword() {
    const pass = document.getElementById('password-input').value;
    if (pass === CONFIG.passCorrecto) document.getElementById('login-overlay').style.display = 'none';
    else document.getElementById('error-msg').style.display = 'block';
}
document.getElementById('password-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPassword(); });

// =========================================================
// --- 2. INICIALIZACIÓN DEL MAPA ---
// =========================================================
const map = L.map('map').setView(CONFIG.centroInicial, CONFIG.zoomInicial);

const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map),
    "Google Híbrido": L.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=es&x={x}&y={y}&z={z}', { attribution: '© Google' }),
    "Google Tráfico": L.tileLayer('https://mt1.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}', { attribution: '© Google' })
};
L.control.layers(baseMaps).addTo(map);

// =========================================================
// --- 3. BUSCADOR Y UBICACIÓN ---
// =========================================================
L.Control.geocoder({ defaultMarkGeocode: false, placeholder: "Buscar dirección...", errorMessage: "Sin resultados." })
.on('markgeocode', function(e) {
    map.fitBounds(e.geocode.bbox);
    L.marker(e.geocode.center).addTo(map).bindPopup(`<b>Ubicación:</b><br>${e.geocode.name}`).openPopup();
    document.getElementById('btn-reset-vista').style.display = 'block';
}).addTo(map);

map.on('mousemove', e => document.getElementById('coordenadas-puntero').innerHTML = `Lat: ${e.latlng.lat.toFixed(5)} | Lng: ${e.latlng.lng.toFixed(5)}`);
map.on('contextmenu', e => L.popup().setLatLng(e.latlng).setContent(`<div style="font-size:12px"><b>Coord:</b><br>${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}</div>`).openOn(map));

const ControlUbicacion = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom btn-ubicacion');
        btn.innerHTML = '📍';
        btn.style.cssText = 'background: white; width: 34px; height: 34px; font-size: 18px; cursor: pointer; border: none;';
        btn.title = "Ir a mi ubicación";
        btn.onclick = function(e){ e.preventDefault(); map.locate({setView: true, maxZoom: 16}); }
        return btn;
    }
});
map.addControl(new ControlUbicacion());
map.on('locationfound', e => L.circleMarker(e.latlng, { radius: 8, fillColor: "#2c3e50", color: "#fff", weight: 2, fillOpacity: 0.8 }).addTo(map).bindPopup("Estás aquí").openPopup());

// =========================================================
// --- 4. CARGA DE POLÍGONOS TEMÁTICOS ---
// =========================================================
let capaMunicipios, capaColonias;
let capaPildoras = L.layerGroup(); // Grupo para encender/apagar todas las bolitas juntas
window.coloniaSeleccionada = null; 

Promise.all([
    fetch('municipios.geojson').then(res => res.json()),
    fetch('colonias.geojson').then(res => res.json())
]).then(([dataMunicipios, dataColonias]) => {
    
    capaMunicipios = L.geoJSON(dataMunicipios, {
        pmIgnore: true, style: { color: '#333', weight: 1.5, fillColor: '#333', fillOpacity: 0.05 },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.nom_mun) layer.bindTooltip(feature.properties.nom_mun, { permanent: true, direction: "center", className: "etiqueta-municipio" });
            layer.on('click', function() { map.fitBounds(layer.getBounds()); document.getElementById('btn-reset-vista').style.display = 'block'; });
        }
    }).addTo(map);

    capaColonias = L.geoJSON(dataColonias, {
        pmIgnore: true, 
        style: function(feature) {
            let colorSemoforo = getColorPondera(feature.properties.pondera);
            if (colorSemoforo) {
                // Si tiene ponderación, la pintamos con el color de riesgo
                return { color: '#666', weight: 1.5, fillColor: colorSemoforo, fillOpacity: 0.55 };
            } else {
                // Si no tiene, se queda transparente con borde punteado
                return { color: '#888', weight: 1.5, dashArray: '4, 4', fillColor: '#fff', fillOpacity: 0.01 };
            }
        },
        onEachFeature: function (feature, layer) {
            let p = feature.properties;
            let nombre = p.nom_col || 'S/N';
            
            // 1. Extraer y sumar métricas (Truncando a 2 decimales)
            const fNum = (num) => parseFloat(Number(num).toFixed(2)); // Herramienta de redondeo
            
            let vals = {
                'INCIDENCIA': fNum(p['INCIDENCIA'] || 0),
                'DO': fNum(p['DO'] || 0),
                'POB_VIAL': fNum((parseFloat(p['POB']) || 0) + (parseFloat(p['RED VIAL']) || 0)), // La suma mágica
                'CONF_SOC': fNum(p['CONF_SOC'] || 0),
                'CARAC_FIS': fNum(p['CARAC_FIS'] || 0),
                'UNID_ECO': fNum(p['UNID_ECO'] || 0)
            };
            
            // Calculamos el total y también lo redondeamos
            let totalBruto = p['TOTAL'] !== null ? parseFloat(p['TOTAL']) : Object.values(vals).reduce((a, b) => a + b, 0);
            let total = fNum(totalBruto);

            // 2. Construir HTML del Popup y la Píldora Visual
            let popupHTML = `<div class="popup-tematico"><h4>Colonia: ${nombre}</h4><ul class="lista-metricas">`;
            let pildoraHTML = '';
            let tieneBolitas = false;

            METRICAS.forEach(m => {
                let valor = vals[m.id];
                let isVacio = valor === 0;
                let claseVacia = isVacio ? 'metrica-vacia' : '';
                let displayVal = isVacio ? '-' : valor;

                // Agregar al checklist del globo (CON ENLACE AL PANEL)
                popupHTML += `
                    <li class="${claseVacia}">
                        <div class="etiqueta-bolita">
                            <span class="punto-metrica" style="background:${m.color};"></span>
                            <a href="#" class="link-metodologia" onclick="abrirMetodologia('${m.id}'); return false;">${m.nombre}</a>
                        </div>
                        <span class="valor-metrica">${displayVal}</span>
                    </li>
                `;

                if (!isVacio) {
                    pildoraHTML += `<span class="punto-metrica" style="background:${m.color};" title="${m.nombre}: ${valor}"></span>`;
                    tieneBolitas = true;
                }
            });

            // Cerrar el HTML del popup con el Total
            popupHTML += `
                <li style="margin-top: 8px; border-top: 2px solid #ccc; padding-top: 6px;">
                    <strong>TOTAL</strong>
                    <strong style="font-size: 14px; color: ${getColorPondera(p.pondera) || '#333'};">${total}</strong>
                </li></ul></div>`;

            layer.bindPopup(popupHTML);

            // Cerrar el HTML del popup con el Total
            popupHTML += `
                <li style="margin-top: 8px; border-top: 2px solid #ccc; padding-top: 6px;">
                    <strong>TOTAL</strong>
                    <strong style="font-size: 14px; color: ${getColorPondera(p.pondera) || '#333'};">${total}</strong>
                </li></ul></div>`;

            layer.bindPopup(popupHTML);

            // 3. Crear el marcador de Píldora en el Centroide de la colonia
            if (tieneBolitas) {
                try {
                    let centroide = turf.centroid(feature).geometry.coordinates;
                    let iconoPildora = L.divIcon({
                        className: 'contenedor-pildora-invisible', 
                        html: `<div class="pildora-metricas">${pildoraHTML}</div>`,
                        iconSize: null, // Que el navegador decida el tamaño
                        iconAnchor: [25, 12] // Para centrarlo visualmente
                    });
                    // Agregamos el marcador al LayerGroup, no al mapa directo
                    L.marker([centroide[1], centroide[0]], { icon: iconoPildora, interactive: false }).addTo(capaPildoras);
                } catch(e) { console.error("Error calculando centroide", e); }
            }

            // 4. Interacción al hacer Clic (Destacar)
            layer.on('click', function(e) {
                if (window.coloniaSeleccionada) capaColonias.resetStyle(window.coloniaSeleccionada);
                window.coloniaSeleccionada = layer;
                
                // Lo pintamos de cian pero conservamos algo del color de fondo si lo tiene
                let tieneFondo = p.pondera && p.pondera.trim() !== '';
                layer.setStyle({ color: '#00FFFF', weight: 4, dashArray: '', fillOpacity: tieneFondo ? 0.75 : 0.15 });
                
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
                map.fitBounds(layer.getBounds());
                document.getElementById('btn-reset-vista').style.display = 'block';
            });
        }
    });

    document.getElementById('loader-overlay').style.display = 'none';
    controlarZoom();

}).catch(error => {
    document.getElementById('loader-overlay').innerHTML = `<h3 style="color:red;">Error cargando los mapas. Verifica los archivos GeoJSON.</h3>`;
});

// =========================================================
// --- 5. LÓGICA DE VISIBILIDAD (Píldoras y Etiquetas) ---
// =========================================================
function controlarZoom() {
    let zoom = map.getZoom();
    let container = document.getElementById('map');
    
    if (zoom >= CONFIG.zoomEtiquetasMun) container.classList.remove('ocultar-etiquetas');
    else container.classList.add('ocultar-etiquetas');

    if (capaColonias) {
        if (zoom >= CONFIG.zoomParaColonias) {
            if (!map.hasLayer(capaColonias)) map.addLayer(capaColonias);
        } else {
            if (map.hasLayer(capaColonias)) {
                if (window.coloniaSeleccionada) { capaColonias.resetStyle(window.coloniaSeleccionada); window.coloniaSeleccionada = null; }
                map.removeLayer(capaColonias);
            }
        }
    }

    // Encender/Apagar las píldoras flotantes con el zoom
    if (capaPildoras) {
        if (zoom >= CONFIG.zoomParaPildoras) {
            if (!map.hasLayer(capaPildoras)) map.addLayer(capaPildoras);
        } else {
            if (map.hasLayer(capaPildoras)) map.removeLayer(capaPildoras);
        }
    }
}
map.on('zoomend', controlarZoom);

window.resetearVista = function() {
    map.setView(CONFIG.centroInicial, CONFIG.zoomInicial);
    document.getElementById('btn-reset-vista').style.display = 'none';
    if (window.coloniaSeleccionada && capaColonias && map.hasLayer(capaColonias)) {
        capaColonias.resetStyle(window.coloniaSeleccionada); window.coloniaSeleccionada = null; 
    }
};

// =========================================================
// --- 6. DIBUJO Y MEDICIÓN ---
// =========================================================
map.pm.addControls({ position: 'topright', drawCircle: true, drawCircleMarker: false, drawMarker: true, drawText: true, drawPolyline: true, drawRectangle: true, drawPolygon: true, editMode: true, dragMode: true, cutPolygon: false, removalMode: true });
map.pm.setGlobalOptions({ measurements: { measurement: false }, pathOptions: { color: '#d9534f', weight: 3 }, lang: 'es' });

map.on('pm:create', function(e) {
    const capa = e.layer;
    let textoMedida = "";
    try {
        if (e.shape === 'Marker') {
            let nombre = prompt("Nombre del punto:", "Nuevo Punto");
            if (nombre) capa.bindTooltip(nombre, { permanent: true, direction: 'top', offset: [0, -25], className: 'etiqueta-punto' }).openTooltip();
            else capa.bindPopup("Punto sin nombre"); return;
        }
        if (e.shape === 'Text') return; 
        const geojson = capa.toGeoJSON();
        if (e.shape === 'Polygon' || e.shape === 'Rectangle') {
            const areaM2 = turf.area(geojson); textoMedida = areaM2 > 10000 ? (areaM2 / 10000).toFixed(2) + " hectáreas" : areaM2.toFixed(2) + " m²";
        } else if (e.shape === 'Line') {
            const distKm = turf.length(geojson, { units: 'kilometers' }); textoMedida = distKm < 1 ? (distKm * 1000).toFixed(2) + " metros" : distKm.toFixed(2) + " km";
        } else if (e.shape === 'Circle') {
            const areaCirculo = Math.PI * Math.pow(capa.getRadius(), 2); textoMedida = areaCirculo > 10000 ? (areaCirculo / 10000).toFixed(2) + " hectáreas" : areaCirculo.toFixed(2) + " m²";
        }
        if (textoMedida !== "") capa.bindTooltip(textoMedida, { permanent: true, direction: 'center', className: 'etiqueta-medida' }).openTooltip();
    } catch (error) { console.error(error); }
});

// =========================================================
// --- 7. CARTOGRAFÍA NATIVA ---
// =========================================================
L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

const ControlNorte = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control norte-flecha');
        div.innerHTML = '<span class="flecha">▲</span><span class="letra">N</span>'; return div;
    }
});
map.addControl(new ControlNorte());

const ControlExportar = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom btn-exportar');
        btn.innerHTML = '💾'; btn.style.cssText = 'background: white; width: 34px; height: 34px; font-size: 18px; cursor: pointer; border: none;';
        btn.title = "Descargar dibujos (GeoJSON)";
        btn.onclick = function(e){
            e.preventDefault(); const capasDibujadas = map.pm.getGeomanDrawLayers();
            if (capasDibujadas.length === 0) { alert("No hay figuras dibujadas."); return; }
            const featureCollection = { type: 'FeatureCollection', features: capasDibujadas.map(c => c.toGeoJSON()) };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(featureCollection));
            const nodoDescarga = document.createElement('a'); nodoDescarga.setAttribute("href", dataStr);
            nodoDescarga.setAttribute("download", "marcadores_tacticos.geojson"); document.body.appendChild(nodoDescarga); nodoDescarga.click(); nodoDescarga.remove();
        }
        return btn;
    }
});
map.addControl(new ControlExportar());

// BOTÓN DE IMPRESIÓN NATIVA 
const ControlImprimir = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom btn-imprimir');
        btn.innerHTML = '🖨️'; btn.style.cssText = 'background: white; width: 34px; height: 34px; font-size: 18px; cursor: pointer; border: none;';
        btn.title = "Imprimir Mapa";
        btn.onclick = function(e){ e.preventDefault(); window.print(); }
        return btn;
    }
});
map.addControl(new ControlImprimir());

const miniMapa = new L.Control.MiniMap(new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { minZoom: 0, maxZoom: 13 }), {
    position: 'bottomleft', toggleDisplay: true, minimized: false, width: 150, height: 150, collapsedWidth: 25, collapsedHeight: 25, zoomLevelOffset: -5 
}).addTo(map);

if (typeof L.latlngGraticule === 'function') {
    L.latlngGraticule({
        showLabel: true, color: '#2c3e50', weight: 0.8, opacity: 0.5, fontColor: '#2c3e50',
        zoomInterval: [{start: 2, end: 8, interval: 0.5}, {start: 9, end: 12, interval: 0.1}, {start: 13, end: 20, interval: 0.02}]
    }).addTo(map);
}

// =========================================================
// --- BOTÓN DE METODOLOGÍA GENERAL ---
// =========================================================
const ControlMetodologia = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
        btn.innerHTML = '📖'; // Ícono de libro (puedes cambiarlo por ℹ️)
        btn.style.cssText = 'background: white; width: 34px; height: 34px; font-size: 18px; cursor: pointer; border: none;';
        btn.title = "Consultar Metodología General";
        
        btn.onclick = function(e){
            e.preventDefault();
            window.abrirMetodologiaGeneral(); // Llamamos a la nueva función
        }
        return btn;
    }
});
map.addControl(new ControlMetodologia());

// =========================================================
// --- 8. LÓGICA DEL PANEL LATERAL DE METODOLOGÍA ---
// =========================================================

// NUEVA FUNCIÓN: Abre la introducción y el índice general
window.abrirMetodologiaGeneral = function() {
    const contenido = document.getElementById('contenido-metodologia');
    
    // Armamos la lista de variables dinámicamente con sus colores
    let listaHTML = '<ul style="list-style:none; padding:0; margin-top: 15px;">';
    METRICAS.forEach(m => {
        listaHTML += `
            <li style="margin-bottom: 12px; cursor: pointer; display: flex; align-items: center;" 
                onclick="abrirMetodologia('${m.id}')" title="Ver detalles de ${m.nombre}">
                <span class="punto-metrica" style="background:${m.color}; margin-right:10px; flex-shrink: 0;"></span>
                <span class="link-metodologia" style="font-size: 14px; font-weight: 500;">${m.nombre}</span>
            </li>
        `;
    });
    listaHTML += '</ul>';

    // Inyectamos el texto general y la lista al panel
    contenido.innerHTML = `
        <h3 style="border-bottom-color: #2c3e50; color: #2c3e50;">
            📖 Metodología del Visor
        </h3>
        <p style="font-size: 14px; text-align: justify;">
            Bienvenido al Visor Cartográfico Táctico. Este mapa interactivo clasifica las colonias basándose en un <b>índice de riesgo compuesto (Pondera)</b>, evaluando diversas variables espaciales, sociales y delictivas.
        </p>
        <p style="font-size: 14px; text-align: justify;">
            <b>¿Cómo interpretar el mapa?</b><br>
            Acércate a las zonas iluminadas para visualizar "píldoras" de colores que indican las características presentes en cada territorio. Haz clic en un polígono para ver su desglose exacto.
        </p>
        <h4 style="margin-top: 25px; margin-bottom: 5px; color: #34495e;">Variables Analizadas:</h4>
        <p style="font-size: 12px; color: #7f8c8d; margin-top: 0;"><i>* Haz clic en cualquier variable para leer su definición.</i></p>
        ${listaHTML}
    `;

    // Deslizamos el panel hacia adentro
    document.getElementById('panel-metodologia').classList.add('abierto');
};

window.abrirMetodologia = function(idMetrica) {
    // 1. Encontrar la métrica en nuestro diccionario
    const metricaObj = METRICAS.find(m => m.id === idMetrica);
    
    // 2. Preparar el HTML interno del panel
    const contenido = document.getElementById('contenido-metodologia');
    contenido.innerHTML = `
        <h3 style="border-bottom-color: ${metricaObj.color};">
            <span class="punto-metrica" style="background:${metricaObj.color}; margin-right:8px;"></span>
            ${metricaObj.nombre}
        </h3>
        <p>${metricaObj.texto}</p>
        <br>
        <p style="font-size: 11px; color: #7f8c8d;"><i>* Datos provenientes de la matriz de análisis espacial.</i></p>
    `;

    // 3. Deslizar el panel hacia adentro
    document.getElementById('panel-metodologia').classList.add('abierto');
};

window.cerrarPanel = function() {
    // Esconder el panel deslizándolo hacia afuera
    document.getElementById('panel-metodologia').classList.remove('abierto');
};