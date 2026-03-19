// =========================================================
// --- 1. CONFIGURACIÓN INICIAL ---
// =========================================================
const CONFIG = {
    centroInicial: [19.4326, -99.1332],
    zoomInicial: 9,
    zoomEtiquetasMun: 10,
    zoomParaColonias: 11, 
    passCorrecto: "2026_SS12"
};

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
// --- 3. BUSCADOR, COORDENADAS Y UBICACIÓN ---
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
// --- 4. CARGA DE POLÍGONOS ---
// =========================================================
let capaMunicipios, capaColonias;
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
        pmIgnore: true, style: function() { return { color: '#888888', weight: 1.5, dashArray: '4, 4', fillColor: '#ffffff', fillOpacity: 0.01 }; },
        onEachFeature: function (feature, layer) {
            let nombre = feature.properties.nom_col || 'S/N';
            layer.bindPopup(`<b>Colonia:</b> ${nombre}`);
            layer.on('click', function(e) {
                if (window.coloniaSeleccionada) capaColonias.resetStyle(window.coloniaSeleccionada);
                window.coloniaSeleccionada = layer;
                layer.setStyle({ color: '#00FFFF', weight: 3.5, dashArray: '', fillColor: '#00FFFF', fillOpacity: 0.15 });
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
// --- 5. DIBUJO Y MEDICIÓN ---
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
// --- 6. CARTOGRAFÍA NATIVA ---
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

// BOTÓN DE IMPRESIÓN NATIVA (La solución definitiva)
const ControlImprimir = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom btn-imprimir');
        btn.innerHTML = '🖨️'; btn.style.cssText = 'background: white; width: 34px; height: 34px; font-size: 18px; cursor: pointer; border: none;';
        btn.title = "Imprimir Mapa";
        btn.onclick = function(e){
            e.preventDefault();
            window.print(); // Llama a la ventana de impresión directa del navegador
        }
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