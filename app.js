// --- CONFIGURACIÓN INICIAL ---
const CONFIG = {
    centroInicial: [19.4326, -99.1332],
    zoomInicial: 9,
    zoomEtiquetasMun: 10,
    zoomParaColonias: 13,
    passCorrecto: "2026_SS12"
};

// --- LOGIN ---
function verificarPassword() {
    const pass = document.getElementById('password-input').value;
    if (pass === CONFIG.passCorrecto) {
        document.getElementById('login-overlay').style.display = 'none';
    } else {
        document.getElementById('error-msg').style.display = 'block';
    }
}
document.getElementById('password-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPassword(); });

// --- MAPA ---
const map = L.map('map').setView(CONFIG.centroInicial, CONFIG.zoomInicial);

const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map),
    "Google Híbrido": L.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=es&x={x}&y={y}&z={z}', { attribution: '© Google' }),
    "Google Tráfico": L.tileLayer('https://mt1.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}', { attribution: '© Google' })
};
L.control.layers(baseMaps).addTo(map);

// =========================================================
// --- BUSCADOR DE DIRECCIONES ---
// =========================================================
const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false, // Evita el marcador por defecto para personalizarlo
    placeholder: "Buscar dirección, colonia o lugar...",
    errorMessage: "No se encontraron resultados."
}).on('markgeocode', function(e) {
    const bbox = e.geocode.bbox; 
    const centro = e.geocode.center; 

    map.fitBounds(bbox);

    L.marker(centro).addTo(map)
        .bindPopup(`<b>Ubicación encontrada:</b><br>${e.geocode.name}`)
        .openPopup();

    document.getElementById('btn-reset-vista').style.display = 'block';
}).addTo(map);

// =========================================================
// --- COORDENADAS EN TIEMPO REAL ---
// =========================================================
map.on('mousemove', function(e) {
    document.getElementById('coordenadas-puntero').innerHTML = 
        `Lat: ${e.latlng.lat.toFixed(5)} | Lng: ${e.latlng.lng.toFixed(5)}`;
});

// =========================================================
// --- BOTÓN DE MI UBICACIÓN (Geolocalización Nativa) ---
// =========================================================
const ControlUbicacion = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
        btn.innerHTML = '📍';
        btn.style.backgroundColor = 'white';
        btn.style.width = '34px';
        btn.style.height = '34px';
        btn.style.fontSize = '18px';
        btn.style.cursor = 'pointer';
        btn.style.border = 'none';
        btn.title = "Ir a mi ubicación";
        
        btn.onclick = function(e){
            e.preventDefault();
            map.locate({setView: true, maxZoom: 16});
        }
        return btn;
    }
});
map.addControl(new ControlUbicacion());

map.on('locationerror', function(e) {
    alert("No se pudo acceder a tu ubicación. Verifica los permisos de tu navegador.");
});

map.on('locationfound', function(e) {
    L.circleMarker(e.latlng, { radius: 8, fillColor: "#2c3e50", color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.8 }).addTo(map)
        .bindPopup("Estás aquí").openPopup();
});

// =========================================================
// --- CARGA OPTIMIZADA DE CAPAS GEOGRÁFICAS ---
// =========================================================
let capaMunicipios, capaColonias;

Promise.all([
    fetch('municipios.geojson').then(res => res.json()),
    fetch('colonias.geojson').then(res => res.json())
]).then(([dataMunicipios, dataColonias]) => {
    
    // 1. Procesar Municipios
    capaMunicipios = L.geoJSON(dataMunicipios, {
        pmIgnore: true, // <--- ESTA LÍNEA EVITA EL CRASH
        style: { color: '#333', weight: 1.5, fillColor: '#333', fillOpacity: 0.05 },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.nom_mun) {
                layer.bindTooltip(feature.properties.nom_mun, { 
                    permanent: true, direction: "center", className: "etiqueta-municipio" 
                });
            }
            layer.on('click', function() {
                map.fitBounds(layer.getBounds());
                document.getElementById('btn-reset-vista').style.display = 'block';
            });
        }
    }).addTo(map);

    // 2. Procesar Colonias
    capaColonias = L.geoJSON(dataColonias, {
        pmIgnore: true, // <--- AQUÍ TAMBIÉN
        style: { color: '#666', weight: 1, dashArray: '3, 4', fillColor: '#000', fillOpacity: 0 },
        onEachFeature: function (feature, layer) {
            let nombre = feature.properties.nom_col || 'S/N';
            layer.bindPopup(`<b>Colonia:</b> ${nombre}`);
        }
    });

    // 3. Ocultar pantalla de carga
    document.getElementById('loader-overlay').style.display = 'none';
    
    // Validar el zoom inicial por si las colonias deben prenderse de inmediato
    controlarZoom();

}).catch(error => {
    console.error("Error al cargar los datos espaciales:", error);
    document.getElementById('loader-overlay').innerHTML = `<h3 style="color:red;">Error cargando los mapas. Verifica los archivos GeoJSON.</h3>`;
});

// =========================================================
// --- HERRAMIENTA DE MEDICIÓN Y DIBUJO (Con Turf.js) ---
// =========================================================

// 1. Agregamos los controles de Geoman (Solo para dibujar)
map.pm.addControls({
    position: 'topright',
    drawCircle: false,         
    drawCircleMarker: false,
    drawMarker: false,
    drawText: false,
    drawPolyline: true,        
    drawRectangle: true,       
    drawPolygon: true,         
    editMode: true,            
    dragMode: true,            
    cutPolygon: false,
    removalMode: true          
});

// 2. Apagamos las medidas nativas fallidas y le damos color
map.pm.setGlobalOptions({
    measurements: { measurement: false }, // Apagamos el que no funciona
    pathOptions: { color: '#d9534f', weight: 3 }, 
    lang: 'es' 
});

// 3. CÁLCULO INFALIBLE CON TURF.JS
map.on('pm:create', function(e) {
    const capa = e.layer;
    const geojson = capa.toGeoJSON();
    let textoMedida = "";

    try {
        // Si dibujó un polígono o rectángulo (ÁREA)
        if (e.shape === 'Polygon' || e.shape === 'Rectangle') {
            const areaM2 = turf.area(geojson);
            
            if (areaM2 > 10000) {
                textoMedida = (areaM2 / 10000).toFixed(2) + " hectáreas";
            } else {
                textoMedida = areaM2.toFixed(2) + " m²";
            }
        } 
        // Si dibujó una línea (DISTANCIA)
        else if (e.shape === 'Line') {
            const distanciaKm = turf.length(geojson, { units: 'kilometers' });
            
            if (distanciaKm < 1) {
                textoMedida = (distanciaKm * 1000).toFixed(2) + " metros";
            } else {
                textoMedida = distanciaKm.toFixed(2) + " km";
            }
        }

        // Le pegamos la etiqueta permanentemente en el centro de la figura
        if (textoMedida !== "") {
            capa.bindTooltip(textoMedida, { 
                permanent: true, 
                direction: 'center', 
                className: 'etiqueta-medida' 
            }).openTooltip();
        }

    } catch (error) {
        console.error("Error calculando la medida:", error);
    }
});

// =========================================================
// --- MINI-MAPA DE REFERENCIA ---
// =========================================================
// Creamos una capa base ligera e independiente exclusiva para el minimapa
const urlMiniMapa = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const capaMiniMapa = new L.TileLayer(urlMiniMapa, { 
    minZoom: 0, 
    maxZoom: 13, 
    attribution: '' 
});

const miniMapa = new L.Control.MiniMap(capaMiniMapa, {
    position: 'bottomleft',
    toggleDisplay: true,       // Agrega un botoncito para ocultarlo y que no estorbe
    minimized: false,          // Inicia abierto
    width: 150,                // Tamaño en píxeles
    height: 150,
    collapsedWidth: 25,
    collapsedHeight: 25,
    zoomLevelOffset: -5        // Qué tan alejado está respecto al mapa principal
}).addTo(map);


// --- GESTIÓN DE VISIBILIDAD DINÁMICA ---
function controlarZoom() {
    let zoom = map.getZoom();
    let container = document.getElementById('map');

    // Etiquetas de municipios
    if (zoom >= CONFIG.zoomEtiquetasMun) container.classList.remove('ocultar-etiquetas');
    else container.classList.add('ocultar-etiquetas');

    // Capa de colonias
    if (capaColonias) {
        if (zoom >= CONFIG.zoomParaColonias) {
            if (!map.hasLayer(capaColonias)) map.addLayer(capaColonias);
        } else {
            if (map.hasLayer(capaColonias)) map.removeLayer(capaColonias);
        }
    }
}

map.on('zoomend', controlarZoom);

// --- UTILIDADES ---
window.resetearVista = function() {
    map.setView(CONFIG.centroInicial, CONFIG.zoomInicial);
    document.getElementById('btn-reset-vista').style.display = 'none';
};

// Clic derecho para coordenadas
map.on('contextmenu', (e) => {
    L.popup()
        .setLatLng(e.latlng)
        .setContent(`<div style="font-size:12px"><b>Coord:</b><br>${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}</div>`)
        .openOn(map);
});