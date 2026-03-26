// =========================================================
// --- 1. CONFIGURACIÓN INICIAL ---
// =========================================================
const CONFIG = {
    centroInicial: [19.4326, -99.1332],
    zoomInicial: 9,
    zoomEtiquetasMun: 12,
    zoomParaColonias: 11, 
    zoomParaPildoras: 15, // <--- Nuevo: Nivel de zoom para mostrar las bolitas flotantes
    passCorrecto: "2026_SS12"
};

// DICCIONARIO DE MÉTRICAS (Orden estricto, colores y textos de metodología)
const METRICAS = [
    { 
        id: 'INCIDENCIA', 
        nombre: 'Incidencia delictiva', 
        color: '#bf9000', 
        texto: 'Se genera a partir del reporte mensual de denuncias de delitos y extorsión, obteniendo el total de delitos por municipio, colonia y vialidades mediante fuentes como el 9-1-1 y 089. Esta variable aporta el 30% del riesgo total general.' 
    },
    { 
        id: 'DO', 
        nombre: 'Delincuencia Organizada', 
        color: '#7030a0', 
        texto: 'Identifica la presencia, rutas de traslado y control de territorios por grupos delictivos, incluyendo riesgos de extorsión y tráfico de drogas, armas y personas. Se basa en fuentes abiertas y de la Unidad de Análisis Criminal, y representa el 10% del nivel de vulnerabilidad.' 
    },
    { 
        id: 'POB_VIAL', 
        nombre: 'Población y vialidades', 
        color: '#92deba', 
        texto: 'Integra proyecciones de población a nivel AGEB (INEGI) y el cálculo de la conectividad urbana de vialidades periféricas mediante técnicas de Space Syntax. En conjunto, la población (5%) y las vialidades (15%) representan el 20% de la ponderación total.' 
    },
    { 
        id: 'CONF_SOC', 
        nombre: 'Conflictividad social', 
        color: '#cc3399', 
        texto: 'Considera las movilizaciones sociales (temas político-sociales, movimientos civiles y grupos de choque) que pudieran replicarse en las zonas de análisis. Su valor es del 20%, dividido equitativamente entre la presencia de organizaciones y la gravedad del tipo de evento (manifestaciones, bloqueos, etc.).' 
    },
    { 
        id: 'CARAC_FIS', 
        nombre: 'Características físicas', 
        color: '#00b0f0', 
        texto: 'Identifica zonas susceptibles a inundaciones basándose en su topografía y cercanía a cuerpos de agua, utilizando el Atlas Nacional de Riesgos y modelos hidrológicos. Este factor de riesgo hidrometeorológico equivale al 10% del total.' 
    },
    { 
        id: 'UNID_ECO', 
        nombre: 'Unidades económicas', 
        color: '#0f395f', 
        texto: 'Evalúa la concentración de infraestructuras clave (hospitales, plazas comerciales, bares) cuya densidad poblacional o valor estratégico incrementa la vulnerabilidad y la presión sobre los servicios de emergencia. Aporta el 10% al cálculo del mapa.' 
    }
];

// DICCIONARIO DE RUTAS DE MOVILIDAD
const RUTAS_CONFIG = {
    1: { nombre: "Carretera al Aeropuerto (AIFA)", color: "#004aad" },
    2: { nombre: "Toluca - México", color: "#356854" },
    3: { nombre: "Naucalpan - Toluca", color: "#ff751f" },
    4: { nombre: "La Marquesa - México", color: "#7695ff" },
    5: { nombre: "Tren Interurbano", color: "#e8d961" }
};

// DICCIONARIO DE PUEBLOS MÁGICOS
const PUEBLOS_CONFIG = {
    'ACULCO': '#5bb0cd', 'EL ORO': '#b8cc1e', 'IXTAPAN DE LA SAL': '#62ea5e',
    'JILOTEPEC': '#d10fd8', 'MALINALCO': '#1bcdac', 'METEPEC': '#df379f',
    'OTUMBA': '#8d82e7', 'SAN MARTÍN DE LAS PIRÁMIDES': '#b578eb',
    'TEOTIHUACÁN': '#83eaac', 'TEPOTZOTLÁN': '#d00f32', 'TONATICO': '#e8c888',
    'VALLE DE BRAVO': '#7d98d1', 'VILLA DEL CARBÓN': '#6ccc19'
};

// Agrega estas variables junto a tus otras capas (capaRutas, capaEstaciones, etc.)
let capaMunicipiosMagicos;
let capaPuntosMagicos;
let capaInfraestructura;
let capaRutas;



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
// --- 4. CARGA DE POLÍGONOS TEMÁTICOS (FASE 1: Filtro Dinámico) ---
// =========================================================
let capaMunicipios, capaColonias;
let capaPildoras = L.layerGroup(); // Grupo para encender/apagar todas las bolitas juntas
window.coloniaSeleccionada = null; 

Promise.all([
    fetch('municipios.geojson').then(res => res.json()),
    fetch('colonias.geojson').then(res => res.json()),
    fetch('carreteras.geojson').then(res => res.json()),
    fetch('estaciones.geojson').then(res => res.json()),
    fetch('pueblos_magicos.geojson').then(res => res.json()),
    fetch('estrcturac.geojson').then(res => res.json())
]).then(([dataMunicipios, dataColonias, dataCarreteras, dataEstaciones, dataPueblosMagicos, dataInfraestructura]) => {
    
    // --- PRE-PROCESAMIENTO: ESCANEO DE MUNICIPIOS ACTIVOS ---
    window.municipiosActivos = new Set(); // Ahora es global
    dataColonias.features.forEach(f => {
        let p = f.properties;
        if (p.pondera && ['Prioritaria', 'Alta', 'Media', 'Baja'].includes(p.pondera.trim())) {
            if (p.nom_mun) window.municipiosActivos.add(p.nom_mun.toUpperCase());
        }
    });

    // Función dinámica para colorear municipios según el zoom
    window.estiloMunicipio = function(feature) {
        let nombreMun = feature.properties.nom_mun ? feature.properties.nom_mun.toUpperCase() : '';
        let zoom = map.getZoom();
        
        if (window.municipiosActivos.has(nombreMun)) {
            // Si nos acercamos a las colonias, quitamos el fondo azul (para no simular agua)
            if (zoom >= CONFIG.zoomParaColonias) {
                return { color: '#2c3e50', weight: 2, fillColor: 'transparent', fillOpacity: 0 };
            } else {
                // Si estamos lejos, destacamos el municipio en azul
                return { color: '#2980b9', weight: 2.5, fillColor: '#3498db', fillOpacity: 0.15 };
            }
        }
        return { color: '#333', weight: 1.5, fillColor: '#333', fillOpacity: 0.05 };
    };

    // --- A. CAPA DE MUNICIPIOS ---
    capaMunicipios = L.geoJSON(dataMunicipios, {
        pmIgnore: true, 
        style: window.estiloMunicipio, // Usamos la nueva función
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.nom_mun) {
                layer.bindTooltip(feature.properties.nom_mun, { permanent: true, direction: "center", className: "etiqueta-municipio" });
            }
            layer.on('click', function() { 
                map.fitBounds(layer.getBounds()); 
                document.getElementById('btn-reset-vista').style.display = 'block'; 
            });
        }
    }).addTo(map);

    // --- B. CAPA DE COLONIAS (Filtrada inteligentemente) ---
    capaColonias = L.geoJSON(dataColonias, {
        pmIgnore: true, 
        filter: function(feature) {
            // EL FILTRO MÁGICO: Solo permite dibujar la colonia si su municipio está en la lista de activos
            let nombreMun = feature.properties.nom_mun ? feature.properties.nom_mun.toUpperCase() : '';
            return municipiosActivos.has(nombreMun);
        },
        style: function(feature) {
            let colorSemoforo = getColorPondera(feature.properties.pondera);
            if (colorSemoforo) {
                return { color: '#666', weight: 1.5, fillColor: colorSemoforo, fillOpacity: 0.55 };
            } else {
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
                'POB_VIAL': fNum((parseFloat(p['POB']) || 0) + (parseFloat(p['RED VIAL']) || 0)), 
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
            // 3. Crear el marcador de Píldora en el Centroide de la colonia
            if (tieneBolitas) {
                try {
                    let centroide = turf.centroid(feature).geometry.coordinates;
                    let iconoPildora = L.divIcon({
                        className: 'contenedor-pildora-invisible', 
                        html: `<div class="pildora-metricas">${pildoraHTML}</div>`,
                        iconSize: null, 
                        iconAnchor: [25, 12] 
                    });
                    // Agregamos el marcador al LayerGroup, no al mapa directo
                    L.marker([centroide[1], centroide[0]], { icon: iconoPildora, interactive: false }).addTo(capaPildoras);
                } catch(e) {}
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


// --- C. CAPA DE RUTAS DE MOVILIDAD (FASE 3) ---
    capaRutas = L.geoJSON(dataCarreteras, {
        pmIgnore: true,
        style: function(feature) {
            let idRuta = feature.properties.objectid;
            let config = RUTAS_CONFIG[idRuta];
            if (config) {
                // Le damos un grosor de 5 para que parezcan autopistas importantes
                return { color: config.color, weight: 5, opacity: 0.9 };
            }
            return { color: '#888', weight: 3, opacity: 0.5 }; // Por si hay una línea sin ID
        },
        onEachFeature: function(feature, layer) {
            let p = feature.properties;
            let idRuta = p.objectid;
            let config = RUTAS_CONFIG[idRuta];
            
            let nombreOficial = p.nombrevial || 'Vía sin nombre';
            let nombreRuta = config ? config.nombre : 'Ruta Desconocida';

            // 1. Etiqueta flotante que sigue al mouse (Tooltip)
            layer.bindTooltip(`
                <div style="text-align: center; min-width: 150px;">
                    <b style="color:${config ? config.color : '#333'}; font-size:14px;">${nombreRuta}</b><br>
                    <span style="font-size:11px; color:#666;">Tramo: ${nombreOficial}</span>
                </div>
            `, { sticky: true, className: 'etiqueta-ruta' });

            // 2. Acción de clic (Abre el panel de Planificación de viaje)
            layer.on('click', function(e) {
                // Efecto visual: la línea "brilla" al darle clic
                layer.setStyle({ weight: 8, color: '#00ffff' });
                setTimeout(() => capaRutas.resetStyle(layer), 1500);

                // Mandamos llamar al panel pasándole el ID de la imagen, el nombre y el color
                window.abrirPanelRuta(idRuta, nombreRuta, config ? config.color : '#333');
            });
        }
    });

    // Ocultar pantalla de carga e iniciar
    document.getElementById('loader-overlay').style.display = 'none';
    controlarZoom();


// --- D. CAPA DE ESTACIONES DEL TREN (Se prende junto con las rutas) ---
    capaEstaciones = L.geoJSON(dataEstaciones, {
        pmIgnore: true,
        pointToLayer: function(feature, latlng) {
            // Creamos un marcador HTML personalizado con el emoji del tren
            let iconoTren = L.divIcon({
                className: 'icono-estacion-tren',
                html: `<div style="font-size: 18px; background: white; border-radius: 50%; border: 3px solid #e8d961; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">🚆</div>`,
                iconSize: [38, 38], // Tamaño total del contenedor
                iconAnchor: [19, 19] // Centrado exacto en la coordenada
            });
            return L.marker(latlng, {icon: iconoTren});
        },
        onEachFeature: function(feature, layer) {
            let nombreEstacion = feature.properties.Estacion || 'Estación sin nombre';
            
            // Le ponemos su globo de texto que aparece al pasar el mouse
            layer.bindTooltip(`
                <div style="text-align: center;">
                    <b style="color:#2c3e50; font-size:13px;">🚆 Estación Interurbano</b><br>
                    <span style="font-size:12px; color:#666;">${nombreEstacion}</span>
                </div>
            `, { direction: 'top', offset: [0, -15], className: 'etiqueta-ruta' });
        }
    });

// --- E. CAPA DE MUNICIPIOS MÁGICOS (Polígonos reciclados) ---
    capaMunicipiosMagicos = L.geoJSON(dataMunicipios, {
        pmIgnore: true,
        interactive: false, // Lo hacemos 'fantasma' para que los clics pasen hacia las colonias o puntos
        filter: function(feature) {
            let nom = feature.properties.nom_mun ? feature.properties.nom_mun.toUpperCase() : '';
            return PUEBLOS_CONFIG[nom] !== undefined; // Solo permite pasar a los de la lista
        },
        style: function(feature) {
            let nom = feature.properties.nom_mun.toUpperCase();
            let colorPueblo = PUEBLOS_CONFIG[nom];
            return { color: colorPueblo, weight: 2.5, fillColor: colorPueblo, fillOpacity: 0.25 };
        }
    });

    // --- F. CAPA DE PUNTOS TURÍSTICOS (Lugares Emblemáticos) ---
    capaPuntosMagicos = L.geoJSON(dataPueblosMagicos, {
        pmIgnore: true,
        pointToLayer: function(feature, latlng) {
            let municipio = feature.properties.Municipio ? feature.properties.Municipio.toUpperCase() : '';
            let colorPueblo = PUEBLOS_CONFIG[municipio] || '#333';
            
            // Un marcador circular elegante con un destello
            let iconoTuristico = L.divIcon({
                className: 'icono-pueblo-magico',
                html: `<div style="font-size: 16px; background: white; border-radius: 50%; border: 3px solid ${colorPueblo}; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">✨</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });
            return L.marker(latlng, {icon: iconoTuristico});
        },
        onEachFeature: function(feature, layer) {
            let municipio = feature.properties.Municipio ? feature.properties.Municipio.toUpperCase() : 'Desconocido';
            let lugar = feature.properties["Lugar Emblemático"] || 'Lugar sin nombre';
            let colorPueblo = PUEBLOS_CONFIG[municipio] || '#333';

            layer.bindTooltip(`
                <div style="text-align: center; min-width: 120px;">
                    <b style="color:${colorPueblo}; font-size:13px;">${municipio}</b><br>
                    <span style="font-size:12px; color:#666;">${lugar}</span>
                </div>
            `, { direction: 'top', offset: [0, -15], className: 'etiqueta-ruta' });

            // Al darle clic, abrimos el panel táctico
            layer.on('click', function() {
                window.abrirPanelPueblo(lugar, municipio, colorPueblo);
            });
        }
    });

// --- G. CAPA DE INFRAESTRUCTURA CRÍTICA ---
    capaInfraestructura = L.geoJSON(dataInfraestructura, {
        pmIgnore: true,
        pointToLayer: function(feature, latlng) {
            let nombre = feature.properties.PuntoC || 'Punto Crítico';
            let emoji = '🏢'; // Icono por defecto
            let color = '#34495e';

            // Asignamos iconos dinámicamente leyendo la columna PuntoC
            let nomUpper = nombre.toUpperCase();
            if(nomUpper.includes('AEROPUERTO') || nomUpper.includes('AIFA') || nomUpper.includes('AIT')) {
                emoji = '✈️'; color = '#2980b9'; // Azul
            } else if(nomUpper.includes('ESTADIO')) {
                emoji = '🏟️'; color = '#c0392b'; // Rojo
            } else if(nomUpper.includes('HOTEL')) {
                emoji = '🏨'; color = '#f39c12'; // Naranja
            } else if(nomUpper.includes('FEDERACIÓN') || nomUpper.includes('FMF')) {
                emoji = '⚽'; color = '#27ae60'; // Verde
            }

            let iconoInfra = L.divIcon({
                className: 'icono-infraestructura',
                html: `<div style="font-size: 18px; background: white; border-radius: 50%; border: 3px solid ${color}; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">${emoji}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            return L.marker(latlng, {icon: iconoInfra});
        },
        onEachFeature: function(feature, layer) {
            let nombre = feature.properties.PuntoC || 'Infraestructura Crítica';

            // El globo al pasar el mouse
            layer.bindTooltip(`
                <div style="text-align: center; min-width: 140px;">
                    <b style="color:#2c3e50; font-size:13px;">Instalación Estratégica</b><br>
                    <span style="font-size:12px; color:#666;">${nombre}</span>
                </div>
            `, { direction: 'top', offset: [0, -15], className: 'etiqueta-ruta' });

            // Al darle clic, abrimos el panel lateral táctico
            layer.on('click', function() {
                window.abrirPanelInfraestructura(nombre);
            });
        }
    });

}).catch(error => {
    console.error("Error cargando capas:", error);
    document.getElementById('loader-overlay').innerHTML = `<h3 style="color:red;">Error cargando los mapas.</h3>`;
});


// =========================================================
// --- 5. LÓGICA DE VISIBILIDAD (Píldoras y Etiquetas) ---
// =========================================================
function controlarZoom() {
    let zoom = map.getZoom();
    let container = document.getElementById('map');

    if (capaMunicipios) capaMunicipios.setStyle(window.estiloMunicipio);
    
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
// --- PANEL DE CAPAS TÁCTICAS (FASE 2) ---
// =========================================================
const ControlCapas = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
        const div = L.DomUtil.create('div', 'panel-capas-custom leaflet-control');
        L.DomEvent.disableClickPropagation(div); // Evita que al dar clic en el menú, le des clic al mapa de fondo
        
        div.innerHTML = `
            <div class="titulo-capas">📋 Capas Tácticas</div>
            <div class="opcion-capa">
                <input type="checkbox" id="chk-colonias" checked>
                <label for="chk-colonias">🛡️ Nivel de Riesgo (Colonias)</label>
            </div>
            <div class="opcion-capa">
                <input type="checkbox" id="chk-rutas">
                <label for="chk-rutas">🛣️ Corredores de Movilidad</label>
            </div>
            <div class="opcion-capa">
                <input type="checkbox" id="chk-infra">
                <label for="chk-infra">✈️ Infraestructura Crítica</label>
            </div>
            <div class="opcion-capa">
                <input type="checkbox" id="chk-pueblos">
                <label for="chk-pueblos">✨ Pueblos Mágicos</label>
            </div>
        `;
        return div;
    }
});
map.addControl(new ControlCapas());

// Conectar el "switch" de Colonias a nuestro mapa
document.addEventListener('change', function(e) {
    if(e.target.id === 'chk-colonias') {
        let zoom = map.getZoom();
        if(e.target.checked) {
            // Prender: Solo mostramos si el nivel de zoom es el correcto
            if(zoom >= CONFIG.zoomParaColonias && capaColonias) map.addLayer(capaColonias);
            if(zoom >= CONFIG.zoomParaPildoras && capaPildoras) map.addLayer(capaPildoras);
        } else {
            // Apagar: Las quitamos de la pantalla y limpiamos selecciones
            if(window.coloniaSeleccionada && capaColonias) {
                capaColonias.resetStyle(window.coloniaSeleccionada);
                window.coloniaSeleccionada = null;
                document.getElementById('btn-reset-vista').style.display = 'none';
            }
            if(map.hasLayer(capaColonias)) map.removeLayer(capaColonias);
            if(map.hasLayer(capaPildoras)) map.removeLayer(capaPildoras);
        }
    }

    if(e.target.id === 'chk-rutas') {
        if(e.target.checked) {
            // Si marcan la casilla, dibujamos las líneas
            if(capaRutas && !map.hasLayer(capaRutas)) map.addLayer(capaRutas);
        } else {
            // Si desmarcan la casilla, las borramos del mapa
            if(capaRutas && map.hasLayer(capaRutas)) map.removeLayer(capaRutas);
        }}


        // Conectar el switch de Rutas de Movilidad y Estaciones
    if(e.target.id === 'chk-rutas') {
        if(e.target.checked) {
            // Prendemos las líneas de carreteras
            if(capaRutas && !map.hasLayer(capaRutas)) map.addLayer(capaRutas);
            // Prendemos los iconos de las estaciones
            if(capaEstaciones && !map.hasLayer(capaEstaciones)) map.addLayer(capaEstaciones);
        } else {
            // Apagamos ambas cosas
            if(capaRutas && map.hasLayer(capaRutas)) map.removeLayer(capaRutas);
            if(capaEstaciones && map.hasLayer(capaEstaciones)) map.removeLayer(capaEstaciones);
        }
    }

    // Conectar el switch de Pueblos Mágicos
    if(e.target.id === 'chk-pueblos') {
        if(e.target.checked) {
            if(capaMunicipiosMagicos && !map.hasLayer(capaMunicipiosMagicos)) map.addLayer(capaMunicipiosMagicos);
            if(capaPuntosMagicos && !map.hasLayer(capaPuntosMagicos)) map.addLayer(capaPuntosMagicos);
        } else {
            if(capaMunicipiosMagicos && map.hasLayer(capaMunicipiosMagicos)) map.removeLayer(capaMunicipiosMagicos);
            if(capaPuntosMagicos && map.hasLayer(capaPuntosMagicos)) map.removeLayer(capaPuntosMagicos);
        }
    }

// Conectar el switch de Infraestructura Crítica
    if(e.target.id === 'chk-infra') {
        if(e.target.checked) {
            if(capaInfraestructura && !map.hasLayer(capaInfraestructura)) map.addLayer(capaInfraestructura);
        } else {
            if(capaInfraestructura && map.hasLayer(capaInfraestructura)) map.removeLayer(capaInfraestructura);
        }
    }

    // NOTA: Los otros switches ('chk-rutas', etc.) los conectaremos en la Fase 3
});

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

// NUEVA FUNCIÓN: Abre el panel con la tabla (imagen) de la ruta
window.abrirPanelRuta = function(idRuta, nombreRuta, colorRuta) {
    const contenido = document.getElementById('contenido-metodologia');
    
    // Armamos el HTML inyectando la etiqueta <img> que busca el archivo .png
    contenido.innerHTML = `
        <h3 style="border-bottom-color: ${colorRuta}; color: ${colorRuta};">
            🛣️ Ruta: ${nombreRuta}
        </h3>
        <p style="font-size: 14px; color: #555; margin-bottom: 15px; text-align: justify;">
            Ficha de planificación de viaje y vulnerabilidades identificadas en este corredor de movilidad.
        </p>
        <div style="text-align: center; margin-top: 15px;">
            <img src="${idRuta}.png" alt="Tabla de datos ruta ${nombreRuta}" 
                 style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
        </div>
        <p style="font-size: 11px; color: #7f8c8d; margin-top: 15px;">
            <i>* Para ver los detalles completos, amplía la imagen o consulta el documento matriz.</i>
        </p>
    `;

    // Deslizamos el panel hacia adentro
    document.getElementById('panel-metodologia').classList.add('abierto');
};

// NUEVA FUNCIÓN: Abre el panel para los Pueblos Mágicos
window.abrirPanelPueblo = function(lugar, municipio, color) {
    const contenido = document.getElementById('contenido-metodologia');
    
    contenido.innerHTML = `
        <h3 style="border-bottom-color: ${color}; color: ${color};">
            ✨ ${lugar}
        </h3>
        <h4 style="margin-top: 5px; color: #555;">Pueblo Mágico: ${municipio}</h4>
        
        <p style="font-size: 14px; color: #333; text-align: justify; margin-top: 15px;">
            Durante el Mundial 2026, los Pueblos Mágicos y destinos turísticos del Estado de México podrían registrar incrementos atípicos en la afluencia, lo que eleva la exposición a delitos patrimoniales y de alto impacto, especialmente en zonas de alta concentración y accesos carreteros.
        </p>
        
        <div style="background: #fdfdfd; border-left: 5px solid ${color}; padding: 12px; margin-top: 20px; font-size: 13px; color: #444; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <b style="color: #2c3e50;">🛡️ Acciones de reforzamiento táctico:</b><br><br>
            • Implementación de operativos turísticos permanentes con presencia visible.<br>
            • Vigilancia focalizada en estacionamientos, zonas arqueológicas, y áreas comerciales.<br>
            • Coordinación para atención inmediata a denuncias (especialmente robo de vehículo).<br>
            • Instalación de módulos de orientación con canales multilingües.<br>
            • Uso de inteligencia preventiva para detectar extorsión o actividades encubiertas.
        </div>
    `;

    document.getElementById('panel-metodologia').classList.add('abierto');
};

// NUEVA FUNCIÓN: Abre el panel para la Infraestructura Crítica
window.abrirPanelInfraestructura = function(nombre) {
    const contenido = document.getElementById('contenido-metodologia');
    
    // Asignamos colores y subtítulos al panel según el tipo
    let color = '#34495e';
    let tipo = 'Instalación Estratégica';
    let nomUpper = nombre.toUpperCase();
    
    if(nomUpper.includes('AEROPUERTO')) { color = '#2980b9'; tipo = 'Nodo de Movilidad Internacional'; }
    else if(nomUpper.includes('ESTADIO')) { color = '#c0392b'; tipo = 'Sede Deportiva'; }
    else if(nomUpper.includes('HOTEL')) { color = '#f39c12'; tipo = 'Sede de Hospedaje'; }
    else if(nomUpper.includes('FEDERACIÓN')) { color = '#27ae60'; tipo = 'Centro de Operaciones'; }

    contenido.innerHTML = `
        <h3 style="border-bottom-color: ${color}; color: ${color};">
            🏢 ${nombre}
        </h3>
        <h4 style="margin-top: 5px; color: #555;">${tipo}</h4>
        
        <p style="font-size: 14px; color: #333; text-align: justify; margin-top: 15px;">
            El diagnóstico operativo identifica a esta instalación como un nodo de máxima prioridad. Las sedes de hospedaje, aeropuertos y estadios requieren monitoreo permanente mediante perímetros de seguridad debido a la concentración masiva y la movilidad de delegaciones internacionales.
        </p>
        
        <div style="background: #fdfdfd; border-left: 5px solid ${color}; padding: 12px; margin-top: 20px; font-size: 13px; color: #444; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <b style="color: #2c3e50;">⚠️ Factores de Riesgo a Monitorear:</b><br><br>
            • <b>Seguridad Perimetral:</b> Revisión estricta de perímetros y gestión de amenazas dirigidas a infraestructuras críticas.<br>
            • <b>Saturación Vial:</b> Riesgo de congestión en las vialidades de acceso por movilizaciones o traslados simultáneos.<br>
            • <b>Bioseguridad:</b> Necesidad de protocolos de vigilancia sanitaria por la alta concentración humana.<br>
            • <b>Servicios de Emergencia:</b> Esta zona requiere canales de respuesta inmediata ante la alta concentración de unidades económicas.
        </div>
    `;

    document.getElementById('panel-metodologia').classList.add('abierto');
};
