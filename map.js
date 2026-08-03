//
// CBS MAP MANAGEMENT SYSTEM
//

const API_URL = 'https://localhost:7183/api';

const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [35.2433, 38.9637],
    zoom: 5.8
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Resize handling to ensure map renders correctly without grey borders
window.addEventListener('resize', () => { if (map) map.resize(); });
setTimeout(() => { if (map) map.resize(); }, 400);

let nehirDataMap = {};
let activeMarkers = [];
let clickBoundRiverLayers = new Set();
let isMarkerClicking = false;
let tumIlVerileri = [];
let isDragDrawing = false;
let isMouseDown = false;
let drawnCoordinates = [];
let tempMarker = null;
let secilenCizimTuru = "nehir";

// Normalizes Turkish characters for case-insensitive comparison
function trNormalize(str) {
    if (!str) return "";
    return str.toString()
        .replace(/İ/g, "i")
        .replace(/I/g, "i")
        .replace(/ı/g, "i")
        .toLowerCase()
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .trim();
}

// Closes all popups currently open on the map
function tumPopuplariKapat() {
    document.querySelectorAll('.maplibregl-popup').forEach(el => el.remove());
}

// Cleans messy or overly long text descriptions
function metniTemizle(metin, varsayilanTur = "Yapı / Bina") {
    if (!metin) return varsayilanTur;
    let str = String(metin).trim();
    if (str.includes("[Güncelleme Talebi]") || str.includes("Gerekçe") || str.includes("Red Sebebi") || str.length > 20) {
        return varsayilanTur;
    }
    return str;
}

// Converts string coordinate data into numerical coordinate arrays
function metniKoordinataCevir(metin) {
    if (!metin) return [];
    const delimiter = metin.includes(';') ? ';' : '|';
    const parcalar = metin.split(delimiter);

    return parcalar.map(cift => {
        if (!cift || !cift.trim()) return null;
        const [boylam, enlem] = cift.split(',');
        if (!boylam || !enlem) return null;
        return [parseFloat(boylam.trim()), parseFloat(enlem.trim())];
    }).filter(item => item !== null);
}

// Line smoothing algorithm to simplify drawn coordinates
function cizgiyiYumusat(points, tolerance = 0.01) {
    if (points.length <= 2) return points;
    let result = [points[0]];
    let lastAdded = points[0];

    for (let i = 1; i < points.length - 1; i++) {
        let dist = Math.hypot(points[i][0] - lastAdded[0], points[i][1] - lastAdded[1]);
        if (dist > tolerance) {
            result.push(points[i]);
            lastAdded = points[i];
        }
    }
    result.push(points[points.length - 1]);
    return result;
}

// =========================================================================
// MAIN FUNCTION TO LOAD ALL MAP LAYERS FROM DATABASE
// =========================================================================
function dynamicLayersLoad() {
    activeMarkers.forEach(m => m.remove());
    activeMarkers = [];

    fetch(`${API_URL}/katmanlar`)
        .then(res => res.json())
        .then(data => {
            // 1. RENDER PROVINCES
            const illerListesi = data.iller || data.Iller || [];
            tumIlVerileri = illerListesi;

            illerListesi.forEach(il => {
                const boylam = parseFloat(il.boylam || il.Boylam || 0);
                const enlem = parseFloat(il.enlem || il.Enlem || 0);
                if (!boylam || !enlem) return;

                const temizPop = metniTemizle(il.population || il.Population, "Bilinmiyor");

                const updateFormHTML = `
                    <div class="popup-form">
                        <b>İl Düzenle</b>
                        <input type="text" id="upName-${il.id}" value="${il.name || il.Name || ''}">
                        <input type="text" id="upDetail-${il.id}" value="${temizPop}">
                        <button onclick="executeDatabaseUpdate('il', ${il.id})">Değişiklikleri Kaydet</button>
                        <button class="delete-btn" onclick="alert('İl gibi temel coğrafi sınırlar haritadan silinemez!')">Veriyi Kaldır</button>
                    </div>`;

                const popup = new maplibregl.Popup({ offset: [0, -10], className: 'custom-popup' }).setHTML(updateFormHTML);
                const markerDiv = document.createElement('div');
                markerDiv.className = 'custom-marker-wrapper';

                const m = new maplibregl.Marker({ element: markerDiv })
                    .setLngLat([boylam, enlem])
                    .setPopup(popup);

                const chkIl = document.getElementById('layerIller');
                if (!chkIl || chkIl.checked) {
                    m.addTo(map);
                }
                activeMarkers.push(m);

                markerDiv.addEventListener('click', () => {
                    tumPopuplariKapat();
                    isMarkerClicking = true;
                    setTimeout(() => { isMarkerClicking = false; }, 300);
                });
            });

            // 2. RENDER RIVERS
            const nehirlerListesi = data.nehirler || data.Nehirler || [];
            nehirlerListesi.forEach(nehir => {
                nehirDataMap[nehir.id] = nehir;
                const rColor = nehir.color || nehir.Color || '#0284c7';
                const kMetni = nehir.koordinat_metni || nehir.koordinat_Metni || nehir.Koordinat_Metni || '';
                const satirlar = metniKoordinataCevir(kMetni);

                if (satirlar.length === 0) return;

                const sourceId = `source-river-${nehir.id}`;
                const layerId = `layer-river-${nehir.id}`;

                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);

                map.addSource(sourceId, {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'geometry': { 'type': 'LineString', 'coordinates': satirlar }
                    }
                });

                const chkNehir = document.getElementById('layerNehirler');
                map.addLayer({
                    'id': layerId,
                    'type': 'line',
                    'source': sourceId,
                    'layout': {
                        'visibility': (!chkNehir || chkNehir.checked) ? 'visible' : 'none',
                        'line-cap': 'round',
                        'line-join': 'round'
                    },
                    'paint': {
                        'line-color': rColor,
                        'line-width': 5.0
                    }
                });

                if (!clickBoundRiverLayers.has(layerId)) {
                    clickBoundRiverLayers.add(layerId);
                    map.on('click', layerId, (e) => {
                        if (isMarkerClicking || isDragDrawing) return;
                        tumPopuplariKapat();
                        const guncelNehir = nehirDataMap[nehir.id];
                        const temizRenk = metniTemizle(guncelNehir.color || guncelNehir.Color, "#0284c7");

                        const updateFormHTML = `
                            <div class="popup-form">
                                <b>Nehir Düzenle</b>
                                <input type="text" id="upName-${nehir.id}" value="${guncelNehir.river_Name || guncelNehir.river_name || guncelNehir.name || ''}">
                                <input type="text" id="upDetail-${nehir.id}" value="${temizRenk}">
                                <button onclick="executeDatabaseUpdate('nehir', ${nehir.id})">Değişiklikleri Kaydet</button>
                                <button class="delete-btn" onclick="alert('Nehirler haritadan silinemez!')">Veriyi Kaldır</button>
                            </div>`;

                        new maplibregl.Popup({ className: 'custom-popup' })
                            .setLngLat([e.lngLat.lng, e.lngLat.lat])
                            .setHTML(updateFormHTML)
                            .addTo(map);

                        e.preventDefault();
                    });
                }
            });

            // 3. RENDER BUILDINGS
            const binalarListesi = data.binalar || data.Binalar || [];

            const binaFeatures = binalarListesi
                .map(k => {
                    const lng = Number(k.boylam ?? k.Boylam ?? 0);
                    const lat = Number(k.enlem ?? k.Enlem ?? 0);

                    if (isNaN(lng) || isNaN(lat) || lng === 0 || lat === 0) {
                        return null;
                    }

                    return {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [lng, lat]
                        },
                        'properties': {
                            'id': k.id,
                            'name': String(k.name || k.Name || 'Yapı / Bina'),
                            'type': String(k.type || k.Type || 'Yapı / Bina')
                        }
                    };
                })
                .filter(f => f !== null);

            if (map.getSource('source-binalar')) {
                map.getSource('source-binalar').setData({
                    'type': 'FeatureCollection',
                    'features': binaFeatures
                });
            } else {
                map.addSource('source-binalar', {
                    'type': 'geojson',
                    'data': { 'type': 'FeatureCollection', 'features': binaFeatures }
                });

                map.addLayer({
                    'id': 'layer-binalar-kamu',
                    'type': 'circle',
                    'source': 'source-binalar',
                    'paint': {
                        'circle-radius': 9,
                        'circle-color': [
                            'match',
                            ['downcase', ['get', 'type']],
                            'konut', '#10b981',
                            'ev', '#10b981',
                            'müstakil ev', '#10b981',
                            'apartman', '#10b981',
                            'ticari', '#3b82f6',
                            '#ff6b00'
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });

                map.on('click', 'layer-binalar-kamu', (e) => {
                    if (isMarkerClicking || isDragDrawing) return;
                    tumPopuplariKapat();
                    const props = e.features[0].properties;
                    const temizBinaTuru = metniTemizle(props.type, "Yapı / Bina");

                    const updateFormHTML = `
                        <div class="popup-form">
                            <div style="font-size:13px; font-weight:bold; color:#f97316; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:4px;">
                                🏛️ ${props.name}
                            </div>
                            <label style="font-size:10px; color:#94a3b8;">Bina Adı:</label>
                            <input type="text" id="upName-${props.id}" value="${props.name}">
                            
                            <label style="font-size:10px; color:#94a3b8; margin-top:4px;">Tür / Açıklama:</label>
                            <input type="text" id="upDetail-${props.id}" value="${temizBinaTuru}">
                            
                            <div style="display:flex; gap:4px; margin-top:8px;">
                                <button onclick="executeDatabaseUpdate('kamubinasi', ${props.id})" style="flex:1;">Kaydet</button>
                                <button class="delete-btn" onclick="kullaniciVeriSil(${props.id}, 'kamubinasi', '${props.name}')" style="flex:1;">🔥 Yanan/Yıkılan Bildir</button>
                            </div>
                        </div>`;

                    new maplibregl.Popup({ className: 'custom-popup' })
                        .setLngLat(e.lngLat)
                        .setHTML(updateFormHTML)
                        .addTo(map);

                    e.preventDefault();
                });

                map.on('mouseenter', 'layer-binalar-kamu', () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', 'layer-binalar-kamu', () => { map.getCanvas().style.cursor = ''; });
            }

            // 4. RENDER ROADS
            const yollarListesi = data.yollar || data.Yollar || [];
            const yolFeatures = yollarListesi.map(y => ({
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': metniKoordinataCevir(y.koordinat_metni || y.koordinat_Metni || y.Koordinat_Metni)
                },
                'properties': { 'id': y.id, 'name': y.name || y.Name || 'Yol', 'type': y.type || y.Type || 'Otoyol' }
            }));

            if (map.getSource('source-yollar')) {
                map.getSource('source-yollar').setData({ 'type': 'FeatureCollection', 'features': yolFeatures });
            } else {
                map.addSource('source-yollar', {
                    'type': 'geojson',
                    'data': { 'type': 'FeatureCollection', 'features': yolFeatures }
                });
                map.addLayer({
                    'id': 'layer-yollar-otoyol',
                    'type': 'line',
                    'source': 'source-yollar',
                    'paint': { 'line-color': '#ef4444', 'line-width': 4.5 }
                });

                map.on('click', 'layer-yollar-otoyol', (e) => {
                    if (isMarkerClicking || isDragDrawing) return;

                    tumPopuplariKapat();

                    const props = e.features[0].properties;
                    const temizYolTuru = metniTemizle(props.type, "Otoyol");

                    const updateFormHTML = `
                        <div class="popup-form">
                            <b>Yol Düzenle (${temizYolTuru})</b>
                            <input type="text" id="upName-${props.id}" value="${props.name}">
                            <input type="text" id="upDetail-${props.id}" value="${temizYolTuru}">
                            <button onclick="executeDatabaseUpdate('yol', ${props.id})">Değişiklikleri Kaydet</button>
                            <button class="delete-btn" onclick="kullaniciVeriSil(${props.id}, 'yol', '${props.name}')">🚧 Yol İzin/Kaldırma Talebi</button>
                        </div>`;

                    new maplibregl.Popup({ className: 'custom-popup' })
                        .setLngLat(e.lngLat)
                        .setHTML(updateFormHTML)
                        .addTo(map);
                    e.preventDefault();
                });
            }
        })
        .catch(err => console.error('Veritabanı katmanlar yüklenemedi:', err));
}

// =========================================================================
// INITIAL MAP LOAD EVENT BLOCK
// =========================================================================
map.on('load', () => {
    map.resize();

    map.addSource('drawing-source', {
        'type': 'geojson',
        'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [] } }
    });

    map.addLayer({
        'id': 'drawing-layer',
        'type': 'line',
        'source': 'drawing-source',
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': { 'line-color': '#2563eb', 'line-width': 5 }
    });

    // DRAW REGIONS UPON MAP INITIALIZATION
    fetch(`${API_URL}/katmanlar`)
        .then(res => res.json())
        .then(data => {
            const bolgelerListesi = data.bolgeler || data.Bolgeler || [];

            const GeoJSONOzellikliBolgeler = {
                "type": "FeatureCollection",
                "features": bolgelerListesi.map(bolge => {
                    const noktalar = metniKoordinataCevir(bolge.koordinat_metni || bolge.koordinat_Metni || bolge.Koordinat_Metni);

                    if (noktalar.length > 0) {
                        if (noktalar[0][0] !== noktalar[noktalar.length - 1][0] || noktalar[0][1] !== noktalar[noktalar.length - 1][1]) {
                            noktalar.push(noktalar[0]);
                        }
                    }

                    return {
                        "type": "Feature",
                        "properties": {
                            "id": bolge.id,
                            "name": bolge.area_Name || bolge.area_name || bolge.name || "",
                            "color": bolge.fill_Color || bolge.fill_color || '#f8fafc'
                        },
                        "geometry": { "type": "Polygon", "coordinates": [noktalar] }
                    };
                })
            };

            map.addSource('turkey-boundaries', { 'type': 'geojson', 'data': GeoJSONOzellikliBolgeler });

            const chkBolge = document.getElementById('layerBolgeler');
            const varsayilanOpacity = (!chkBolge || chkBolge.checked) ? 0.45 : 0.0;

            map.addLayer({
                'id': 'tr-boundaries-fill',
                'type': 'fill',
                'source': 'turkey-boundaries',
                'paint': {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': varsayilanOpacity
                }
            });

            map.addLayer({
                'id': 'tr-boundaries-line',
                'type': 'line',
                'source': 'turkey-boundaries',
                'paint': { 'line-color': '#1e293b', 'line-width': 1.5 }
            });

            // REGION CLICK EVENT & PERMISSION CONTROL
            map.on('click', 'tr-boundaries-fill', (e) => {
                if (isMarkerClicking || isDragDrawing || e.defaultPrevented) return;

                const props = e.features[0].properties;
                const tiklananBolgeAdi = trNormalize(props.name);
                const rol = typeof aktifKullaniciRolTuru !== 'undefined' ? aktifKullaniciRolTuru : '';
                const kullaniciBolge = trNormalize(typeof aktifKullaniciBolge !== 'undefined' ? aktifKullaniciBolge : '');

                if (rol !== "Mudur" && rol !== "Müdür") {
                    let yetkiliMi = false;

                    if (kullaniciBolge.includes("ankara") && (tiklananBolgeAdi.includes("ankara") || tiklananBolgeAdi.includes("anadolu"))) yetkiliMi = true;
                    else if (kullaniciBolge.includes("anadolu") && tiklananBolgeAdi.includes("anadolu")) yetkiliMi = true;
                    else if (kullaniciBolge.includes("izmir") && (tiklananBolgeAdi.includes("izmir") || tiklananBolgeAdi.includes("ege"))) yetkiliMi = true;
                    else if (kullaniciBolge.includes("ege") && tiklananBolgeAdi.includes("ege")) yetkiliMi = true;
                    else if (kullaniciBolge.includes("istanbul") && (tiklananBolgeAdi.includes("istanbul") || tiklananBolgeAdi.includes("marmara"))) yetkiliMi = true;
                    else if (kullaniciBolge.includes("marmara") && tiklananBolgeAdi.includes("marmara")) yetkiliMi = true;
                    else if (kullaniciBolge.includes("akdeniz") && tiklananBolgeAdi.includes("akdeniz")) yetkiliMi = true;

                    if (!yetkiliMi) {
                        alert("🚫 Bu bölgeye erişim ve düzenleme yetkiniz yoktur! Sadece kendi sorumluluk alanınıza müdahale edebilirsiniz.");
                        e.preventDefault();
                        return;
                    }
                }

                tumPopuplariKapat();
                const temizBolgeRengi = metniTemizle(props.color, "#f8fafc");

                const updateFormHTML = `
                    <div class="popup-form">
                        <b>Bölge Düzenle</b>
                        <input type="text" id="upName-${props.id}" value="${props.name}">
                        <input type="text" id="upDetail-${props.id}" value="${temizBolgeRengi}">
                        <button onclick="executeDatabaseUpdate('bolge', ${props.id})">Değişiklikleri Kaydet</button>
                        <button class="delete-btn" onclick="executeDatabaseDelete('bolge', ${props.id})">Veriyi Kaldır</button>
                    </div>`;

                new maplibregl.Popup({ className: 'custom-popup' })
                    .setLngLat(e.lngLat)
                    .setHTML(updateFormHTML)
                    .addTo(map);
            });

            dynamicLayersLoad();
        })
        .catch(err => console.error("Bölge katmanı yüklenemedi:", err));

    // Right-Click Context Menu to Add Data
    map.on('contextmenu', (e) => {
        if (isDragDrawing) return;

        const boylam = e.lngLat.lng;
        const enlem = e.lngLat.lat;

        const rol = typeof aktifKullaniciRolTuru !== 'undefined' ? aktifKullaniciRolTuru : '';
        const bolge = typeof aktifKullaniciBolge !== 'undefined' ? aktifKullaniciBolge : '';
        const cleanBolge = trNormalize(bolge);

        if (rol !== "Mudur" && rol !== "Müdür") {
            let yetkiliSininIcindeMi = true;

            if (cleanBolge === "ankara" || (cleanBolge.includes("ankara") && !cleanBolge.includes("anadolu"))) {
                if (boylam < 32.2000 || boylam > 33.5000 || enlem < 39.3000 || enlem > 40.5000) {
                    yetkiliSininIcindeMi = false;
                }
            }
            else if (cleanBolge.includes("anadolu")) {
                if (boylam < 28.5000 || boylam > 37.5000 || enlem < 36.5000 || enlem > 42.0000) {
                    yetkiliSininIcindeMi = false;
                }
            }
            else if (cleanBolge.includes("izmir")) {
                if (boylam < 26.2000 || boylam > 27.30 || enlem < 37.80 || enlem > 38.55) {
                    yetkiliSininIcindeMi = false;
                }
            }
            else if (cleanBolge.includes("ege")) {
                if (boylam < 26.0000 || boylam > 30.0000 || enlem < 36.5000 || enlem > 40.0000) {
                    yetkiliSininIcindeMi = false;
                }
            }

            if (!yetkiliSininIcindeMi) {
                alert(`🚫 Yetki Sınırı İhlali: Sorumlu olduğunuz bölgenin (${bolge}) dışından veri ekleme yetkiniz yoktur!`);
                return;
            }
        }

        tumPopuplariKapat();

        if (tempMarker) tempMarker.remove();

        tempMarker = new maplibregl.Marker({ color: '#ef4444' })
            .setLngLat([boylam, enlem])
            .addTo(map);

        const buttonHTML = `
            <div class="popup-form" style="text-align:center;">
                <button class="add-btn" onclick="openFullInsertForm(${boylam}, ${enlem})">+ Buraya Veri Ekle</button>
            </div>`;

        const popup = new maplibregl.Popup({ className: 'custom-popup' })
            .setLngLat([boylam, enlem])
            .setHTML(buttonHTML)
            .addTo(map);

        popup.on('close', () => {
            if (!isDragDrawing && tempMarker) {
                tempMarker.remove();
                tempMarker = null;
            }
        });
    });
});

// =========================================================================
// FREEHAND MAP DRAWING CONTROLS
// =========================================================================
function startDragDrawing(tur = "nehir") {
    secilenCizimTuru = tur;

    tumPopuplariKapat();
    if (tempMarker) { tempMarker.remove(); tempMarker = null; }

    isDragDrawing = true;
    drawnCoordinates = [];
    map.dragPan.disable();
    map.getCanvas().style.cursor = 'crosshair';

    const turAdi = (tur === "yol") ? "Yol" : (tur === "bolge") ? "Bölge" : "Nehir";
    alert(`🚧 ${turAdi} Çizim Modu Aktif!\n\nHaritaya basılı tutarak çiziminizi yapın. Fareyi bıraktığınızda kayıt formu açılacaktır.`);
}

map.on('mousedown', (e) => {
    if (!isDragDrawing) return;
    isMouseDown = true;
    drawnCoordinates = [[e.lngLat.lng, e.lngLat.lat]];
});

map.on('mousemove', (e) => {
    if (!isDragDrawing || !isMouseDown) return;
    drawnCoordinates.push([e.lngLat.lng, e.lngLat.lat]);

    map.getSource('drawing-source').setData({
        'type': 'Feature',
        'geometry': { 'type': 'LineString', 'coordinates': drawnCoordinates }
    });
});

map.on('mouseup', () => {
    if (!isDragDrawing || !isMouseDown) return;
    isMouseDown = false;
    isDragDrawing = false;
    map.dragPan.enable();
    map.getCanvas().style.cursor = '';

    if (drawnCoordinates.length < 3) {
        alert("Çok kısa bir hareket oldu, lütfen fareyi biraz daha sürükleyerek çizin.");
        map.getSource('drawing-source').setData({ 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [] } });
        return;
    }

    const yumusatilmisKoordinatlar = cizgiyiYumusat(drawnCoordinates, 0.01);
    const coordString = yumusatilmisKoordinatlar.map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';');

    map.getSource('drawing-source').setData({
        'type': 'Feature',
        'geometry': { 'type': 'LineString', 'coordinates': [] }
    });

    const lastPoint = yumusatilmisKoordinatlar[yumusatilmisKoordinatlar.length - 1];

    openFullInsertForm(lastPoint[0], lastPoint[1], coordString, secilenCizimTuru);
});

function openFullInsertForm(boylam, enlem, hazirKoordinatMetni = "", varsayilanTur = "kamubinasi") {
    const seciliTur = hazirKoordinatMetni ? secilenCizimTuru : varsayilanTur;
    const cizimVarMi = Boolean(hazirKoordinatMetni);

    const formHTML = `
        <div class="popup-form" style="width: 100%; box-sizing: border-box;">
            <b style="color: #34d399; font-size:13px; display:block; margin-bottom:6px;">Yeni CBS Verisi Oluştur</b>
            
            <select id="katmanTuru" onchange="toggleFormFields(${boylam}, ${enlem})" style="width:100%; padding:5px; background:#0f172a; color:white; border:1px solid #475569; border-radius:4px;">
                <option value="il" ${seciliTur === 'il' ? 'selected' : ''}>İl (Nokta)</option>
                <option value="kamubinasi" ${seciliTur === 'kamubinasi' ? 'selected' : ''}>Yapı / Bina (Nokta)</option>
                <option value="nehir" ${seciliTur === 'nehir' ? 'selected' : ''}>Nehir (Çizgi)</option>
                <option value="yol" ${seciliTur === 'yol' ? 'selected' : ''}>Yol / Sokak (Çizgi)</option>
                <option value="bolge" ${seciliTur === 'bolge' ? 'selected' : ''}>Bölge (Poligon)</option>
            </select>
            
            <div id="riverDrawArea" style="display:${(seciliTur === 'nehir' || seciliTur === 'yol' || seciliTur === 'bolge') && !cizimVarMi ? 'block' : 'none'}; margin-top:8px;">
                <button type="button" style="background:#f59e0b; color:white; border:none; padding:8px; width:100%; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="startDragDrawing(document.getElementById('katmanTuru').value)">
                    ✏️ Haritada Çizim Yap
                </button>
            </div>

            <div id="formDetayAlanlari" style="display: ${(seciliTur === 'nehir' || seciliTur === 'yol' || seciliTur === 'bolge') && !cizimVarMi ? 'none' : 'block'};">
                
                ${cizimVarMi ? `<small style="color:#34d399; display:block; margin-top:6px; margin-bottom:4px; font-weight:bold;">☑ Çizim tamamlandı! (${hazirKoordinatMetni.split(';').length} nokta alındı)</small>` : ''}
                <input type="hidden" id="coordText" value="${hazirKoordinatMetni}">

                <input type="text" id="layerName" placeholder="Adı / Unvanı" style="margin-top:6px; width:100%; box-sizing:border-box; padding:5px;">
                <input type="text" id="layerDetail" placeholder="Nüfus / Tür / Açıklama" style="margin-top:6px; width:100%; box-sizing:border-box; padding:5px;">
                
                <div id="ruhsatDosyaAlani" style="margin-top: 6px; display: ${(seciliTur === 'kamubinasi' || seciliTur === 'yol') ? 'block' : 'none'}; text-align: left;">
                    <label style="font-size: 10px; color: #38bdf8; display:block; margin-bottom:2px;">Ruhsat / İzin Belgesi *:</label>
                    <input type="file" id="ruhsatInput" accept=".pdf, image/*" style="font-size: 10px; width: 100%; color:#cbd5e1;">
                </div>

                <button onclick="executeDatabaseInsert(${boylam}, ${enlem})" style="margin-top:10px; width:100%; background:#10b981; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">
                    Veritabanına Kaydet
                </button>
            </div>
        </div>`;

    const popup = new maplibregl.Popup({ className: 'custom-popup' })
        .setLngLat([boylam, enlem])
        .setHTML(formHTML)
        .addTo(map);

    popup.on('close', () => {
        if (!isDragDrawing && tempMarker) {
            tempMarker.remove();
            tempMarker = null;
        }
    });
}

function toggleFormFields(boylam, enlem) {
    const tur = document.getElementById("katmanTuru").value;
    const coordTextElem = document.getElementById("coordText");
    const cizimVarMi = coordTextElem && coordTextElem.value !== "";

    const cizimAlani = document.getElementById("riverDrawArea");
    const detayAlanlari = document.getElementById("formDetayAlanlari");
    const ruhsatDiv = document.getElementById("ruhsatDosyaAlani");

    const cizimGerektiriyorMu = (tur === "nehir" || tur === "yol" || tur === "bolge");

    if (cizimGerektiriyorMu && !cizimVarMi) {
        if (cizimAlani) cizimAlani.style.display = "block";
        if (detayAlanlari) detayAlanlari.style.display = "none";
    } else {
        if (cizimAlani) cizimAlani.style.display = "none";
        if (detayAlanlari) detayAlanlari.style.display = "block";
    }

    if (ruhsatDiv) {
        ruhsatDiv.style.display = (tur === "kamubinasi" || tur === "yol") ? "block" : "none";
    }
}

// =========================================================================
// DATABASE CRUD OPERATIONS
// =========================================================================

// DATABASE INSERT FUNCTION
async function executeDatabaseInsert(boylam, enlem) {
    const katmanTuru = document.getElementById("katmanTuru").value;
    const name = document.getElementById("layerName").value;
    const detay = document.getElementById("layerDetail").value;
    const coordTextElem = document.getElementById("coordText");
    const koordinatMetni = coordTextElem ? coordTextElem.value : "";

    if (!name) {
        alert("Lütfen bir ad/unvan giriniz!");
        return;
    }

    const dosyaInput = document.getElementById("ruhsatInput");

    if ((katmanTuru === "kamubinasi" || katmanTuru === "yol") && (!dosyaInput || dosyaInput.files.length === 0)) {
        const belgeAdi = (katmanTuru === "yol") ? "AYKOME / Yol İzin Belgesi" : "Yapım Ruhsat Belgesi";
        alert(`Lütfen ${katmanTuru === "yol" ? "yol" : "bina"} için geçerli bir ${belgeAdi} seçiniz!`);
        return;
    }

    const formData = new FormData();
    formData.append("katmanTuru", katmanTuru);
    formData.append("name", name);
    formData.append("detay", detay);
    formData.append("boylam", boylam);
    formData.append("enlem", enlem);
    formData.append("koordinatMetni", koordinatMetni);
    formData.append("rol", typeof aktifKullaniciRolTuru !== 'undefined' ? aktifKullaniciRolTuru : "SehirGorevlisi");

    formData.append("ekleyenKullanici", typeof aktifKullaniciAdi !== 'undefined' ? aktifKullaniciAdi : "Mehmet Demir");

    if ((katmanTuru === "kamubinasi" || katmanTuru === "yol") && dosyaInput && dosyaInput.files.length > 0) {
        formData.append("ruhsatDosyasi", dosyaInput.files[0]);
    }

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';

        const res = await fetch(`${baseUrl}/katman/ekle`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);

            if (typeof tempMarker !== 'undefined' && tempMarker && tempMarker.remove) {
                tempMarker.remove();
                tempMarker = null;
            }

            tumPopuplariKapat();

            if (typeof dynamicLayersLoad === 'function') {
                dynamicLayersLoad();
            }
        } else {
            alert("Hata: " + (data.error || "Eklenemedi"));
        }
    } catch (err) {
        console.error("Hata detayı:", err);
        alert("Sunucuya bağlanırken hata oluştu!");
    }
}

function executeDatabaseUpdate(katmanTuru, id) {
    const nameElem = document.getElementById(`upName-${id}`);
    const detayElem = document.getElementById(`upDetail-${id}`);

    const name = nameElem ? nameElem.value.trim() : "";
    const detay = detayElem ? detayElem.value.trim() : "";

    if (!name) return alert('Lütfen bir ad / unvan giriniz.');

    const rol = typeof aktifKullaniciRolTuru !== 'undefined' ? aktifKullaniciRolTuru : "SehirGorevlisi";

    fetch(`${API_URL}/katman/guncelle?rol=${rol}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ katmanTuru, id, name, detay })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message || 'İşlem başarıyla iletildi!');

            if (typeof mesajEkle === 'function') {
                mesajEkle(`"${name}" verisi için düzenleme talebi işlendi.`);
            }

            dynamicLayersLoad();
            tumPopuplariKapat();
        })
        .catch(err => {
            console.error("Güncelleme hatası:", err);
            alert('Güncelleme talebi gönderilirken bir hata oluştu.');
        });
}

function executeDatabaseDelete(katmanTuru, id) {
    const onay = confirm("Bu coğrafi veriyi veritabanından tamamen silmek istediğinize emin misiniz?");
    if (!onay) return;

    fetch(`${API_URL}/katman/sil`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ katmanTuru, id })
    })
        .then(res => res.json())
        .then(() => {
            alert('Veri başarıyla kaldırıldı!');

            if (typeof mesajEkle === 'function') {
                mesajEkle(`Bir ${katmanTuru.toUpperCase()} verisi sistemden silindi. (ID: ${id})`);
            }

            if (typeof silinenYapilariGetir === 'function') {
                silinenYapilariGetir();
            }

            dynamicLayersLoad();
            tumPopuplariKapat();
        })
        .catch(err => {
            console.error("Silme hatası:", err);
            alert("Silme işlemi başarısız oldu.");
        });
}

// =========================================================================
// CREATE REMOVAL & DELETION REQUESTS
// =========================================================================
function kullaniciVeriSil(id, katmanTuru, yapiAdi) {
    const isBina = (katmanTuru === "kamubinasi" || katmanTuru === "kamubinalari" || katmanTuru === "kamu");
    const isYol = (katmanTuru === "yol" || katmanTuru === "yollar");

    if (!isBina && !isYol) {
        alert("⚠️ İl veya Nehir gibi temel coğrafi katmanlar silinemez!");
        return;
    }

    tumPopuplariKapat();

    const modalTitle = isBina ? `🔥 Yanan/Yıkılan Bildir` : `🚧 Yol Kaldırma/İzin Talebi`;
    const belgeLabel = isYol ? "AYKOME / Yol İptal Belgesi" : "Yıkım Ruhsatı / Yangın Raporu";

    const formHTML = `
    <div style="width: 100%; box-sizing: border-box; font-family: sans-serif;">
        <b style="color: #ef4444; font-size: 14px; display: block; margin-bottom: 2px;">${modalTitle}</b>
        <small style="color: #cbd5e1; font-size: 11px; display: block; white-space: normal; margin-bottom: 6px;">
            <b>${yapiAdi}</b>
        </small>
        
        <hr style="border-color: #334155; margin: 6px 0 10px 0;">

        ${isBina ? `
            <div style="margin-bottom: 10px;">
                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">Durum Seçiniz:</label>
                <select id="delete_durum_secim" style="width: 100%; box-sizing: border-box; font-size:12px; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:4px;">
                    <option value="Yıkılan">Yıkılan / Yıkılacak</option>
                    <option value="Yanan">Yanan</option>
                </select>
            </div>
        ` : ''}

        <div style="margin-bottom: 10px;">
            <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">Gerekçe / Sebep *:</label>
            <textarea id="delete_sebep_input" rows="2" placeholder="Neden kaldırılıyor? Detay yazınız..." style="width: 100%; box-sizing: border-box; font-size:12px; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:4px; resize:none;"></textarea>
        </div>

        <div style="margin-bottom: 12px;">
            <label style="font-size: 11px; color: #38bdf8; display:block; margin-bottom:4px; font-weight:bold;">${belgeLabel} *:</label>
            <input type="file" id="delete_file_input" accept=".pdf, image/*" style="width: 100%; box-sizing: border-box; font-size: 11px; color:#cbd5e1;">
        </div>

        <button onclick="executeKullaniciVeriSil(${id}, '${katmanTuru}')" style="width: 100%; box-sizing: border-box; background:#ef4444; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer;">
            Talebi Gönder
        </button>
    </div>`;

    new maplibregl.Popup({ className: 'custom-popup', closeOnClick: true })
        .setLngLat(map.getCenter())
        .setHTML(formHTML)
        .addTo(map);
}

async function executeKullaniciVeriSil(id, katmanTuru) {
    const isBina = (katmanTuru === "kamubinasi" || katmanTuru === "kamubinalari" || katmanTuru === "kamu");
    const durumElem = document.getElementById("delete_durum_secim");
    const secilenDurum = isBina ? (durumElem ? durumElem.value : "Yıkılan") : "Yol İptal / Söküm";

    const sebepElem = document.getElementById("delete_sebep_input");
    const sebep = sebepElem ? sebepElem.value.trim() : "";

    if (!sebep) {
        alert("⚠️ Lütfen kaldırma/silme gerekçesini giriniz!");
        return;
    }

    const fileElem = document.getElementById("delete_file_input");
    if (!fileElem || fileElem.files.length === 0) {
        alert("⚠️ Lütfen geçerli bir izin/ruhsat belgesi (PDF/Resim) seçiniz!");
        return;
    }

    const formData = new FormData();
    formData.append('katmanTuru', katmanTuru);
    formData.append('id', id);
    formData.append('sebep', `[${secilenDurum}] Detay: ${sebep}`);
    formData.append('rol', typeof aktifKullaniciRolTuru !== 'undefined' ? aktifKullaniciRolTuru : "SehirGorevlisi");

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';
        const res = await fetch(`${baseUrl}/katman/sil`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            tumPopuplariKapat();
            if (typeof dynamicLayersLoad === 'function') dynamicLayersLoad();

        } else {
            alert("Hata: " + (data.error || "İşlem başarısız."));
        }
    } catch {
        alert("Talep gönderilirken sunucu taraflı bir hata oluştu.");
    }
}

// =========================================================================
// LAYER VISIBILITY TOGGLE SWITCHES
// =========================================================================
window.toggleLayer = function (katmanAdi) {
    if (katmanAdi === 'iller') {
        const checked = document.getElementById('layerIller')?.checked;
        activeMarkers.forEach(m => {
            if (checked) m.addTo(map);
            else m.remove();
        });
    }
    else if (katmanAdi === 'nehirler') {
        const checked = document.getElementById('layerNehirler')?.checked;
        const visibility = checked ? 'visible' : 'none';
        Object.keys(nehirDataMap).forEach(id => {
            const layerId = `layer-river-${id}`;
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
            }
        });
    }
    else if (katmanAdi === 'bolgeler') {
        const checked = document.getElementById('layerBolgeler')?.checked;
        if (map.getLayer('tr-boundaries-fill')) {
            map.setPaintProperty('tr-boundaries-fill', 'fill-opacity', checked ? 0.45 : 0.0);
        }
    }
    else if (katmanAdi === 'kamubinalari') {
        const checked = document.getElementById('layerKamu')?.checked;
        const vis = checked ? 'visible' : 'none';
        if (map.getLayer('layer-binalar-kamu')) map.setLayoutProperty('layer-binalar-kamu', 'visibility', vis);
    }
    else if (katmanAdi === 'yollar') {
        const checked = document.getElementById('layerYollar')?.checked;
        const vis = checked ? 'visible' : 'none';
        if (map.getLayer('layer-yollar-otoyol')) map.setLayoutProperty('layer-yollar-otoyol', 'visibility', vis);
    }
};