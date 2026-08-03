// Layer, source, and popup variables to highlight searched boundaries
const SEARCH_LAYER_ID = 'search-highlight-layer';
const SEARCH_SOURCE_ID = 'search-highlight-source';
let currentSearchPopup = null;
let currentSearchMarker = null;

// Helper function that creates a circular polygon around a latitude/longitude point
function createGeoJSONCircle(center, radiusInKm) {
    const points = 64;
    const coords = { latitude: center[1], longitude: center[0] };
    const km = radiusInKm;

    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;

    let theta, x, y;
    for (let i = 0; i < points; i++) {
        theta = (i / points) * (2 * Math.PI);
        x = distanceX * Math.cos(theta);
        y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]); // Close the polygon

    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [ret]
        }
    };
}

// Manages dropdown menus or text search box when search category changes
function searchCategoryChanged() {
    console.log("searchCategoryChanged tetiklendi!");

    const selectElem = document.getElementById("sel_search_type");
    if (!selectElem) return;

    const category = selectElem.value;
    console.log("Seçilen kategori:", category);

    const classicBox = document.getElementById("classicSearchBox");
    const addressBox = document.getElementById("addressSearchBox");
    const binaSelect = document.getElementById("searchBina");

    if (category === "binas" || category === "bina" || category === "yol") {
        if (classicBox) classicBox.style.display = "none";
        if (addressBox) addressBox.style.display = "flex";

        if (binaSelect) {
            binaSelect.style.display = (category === "binas" || category === "bina") ? "block" : "none";
        }

        illeriYukle();
    } else {
        if (classicBox) classicBox.style.display = "block";
        if (addressBox) addressBox.style.display = "none";
    }
}

// 1. LOAD CITIES / PROVINCES
function illeriYukle() {
    const ilSelect = document.getElementById("searchIl");
    if (!ilSelect) return;

    ilSelect.innerHTML = '<option value="">-- İl Seçiniz --</option>';

    const iller = [
        "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın",
        "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı",
        "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
        "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul",
        "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya",
        "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu",
        "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli",
        "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale",
        "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
    ];

    iller.forEach(il => {
        const opt = document.createElement("option");
        opt.value = il;
        opt.textContent = il;
        ilSelect.appendChild(opt);
    });
}

// 2. LOAD DISTRICTS WHEN CITY IS SELECTED
async function adresIlDegisti() {
    const il = document.getElementById("searchIl").value;
    let category = document.getElementById("sel_search_type").value;
    if (category === "binas") category = "bina"; // Normalize for C# backend compatibility

    const ilceSelect = document.getElementById("searchIlce");
    const mahalleSelect = document.getElementById("searchMahalle");
    const sokakSelect = document.getElementById("searchSokak");
    const binaSelect = document.getElementById("searchBina");

    ilceSelect.innerHTML = '<option value="">Yükleniyor...</option>';
    ilceSelect.disabled = true;
    mahalleSelect.innerHTML = '<option value="">-- Önce İlçe Seçiniz --</option>';
    mahalleSelect.disabled = true;
    sokakSelect.innerHTML = '<option value="">-- Önce Mahalle Seçiniz --</option>';
    sokakSelect.disabled = true;
    if (binaSelect) {
        binaSelect.innerHTML = '<option value="">-- Önce Sokak Seçiniz --</option>';
        binaSelect.disabled = true;
    }

    if (!il) return;

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';
        console.log(`İlçeler isteniyor: ${il}, Kategori: ${category}`);

        const res = await fetch(`${baseUrl}/adres/ilceler?il=${encodeURIComponent(il)}&kategori=${encodeURIComponent(category)}`);

        if (!res.ok) throw new Error("İlçeler çekilirken sunucu hatası!");

        const ilceler = await res.json();
        console.log("Gelen ilçeler:", ilceler);

        ilceSelect.innerHTML = '<option value="">-- İlçe Seçiniz --</option>';

        if (ilceler && ilceler.length > 0) {
            ilceler.forEach(ilce => {
                const opt = document.createElement("option");
                opt.value = ilce;
                opt.textContent = ilce;
                ilceSelect.appendChild(opt);
            });
            ilceSelect.disabled = false;
        } else {
            ilceSelect.innerHTML = '<option value="">-- Kayıtlı İlçe Bulunamadı --</option>';
        }
    } catch (err) {
        console.error("İlçeler çekilemedi:", err);
        ilceSelect.innerHTML = '<option value="">Hata Oluştu!</option>';
    }
}

// 3. LOAD NEIGHBORHOODS WHEN DISTRICT IS SELECTED
async function adresIlceDegisti() {
    const il = document.getElementById("searchIl").value;
    const ilce = document.getElementById("searchIlce").value;
    let category = document.getElementById("sel_search_type").value;
    if (category === "binas") category = "bina";

    const mahalleSelect = document.getElementById("searchMahalle");
    const sokakSelect = document.getElementById("searchSokak");
    const binaSelect = document.getElementById("searchBina");

    mahalleSelect.innerHTML = '<option value="">Yükleniyor...</option>';
    mahalleSelect.disabled = true;
    sokakSelect.innerHTML = '<option value="">-- Önce Mahalle Seçiniz --</option>';
    sokakSelect.disabled = true;
    if (binaSelect) {
        binaSelect.innerHTML = '<option value="">-- Önce Sokak Seçiniz --</option>';
        binaSelect.disabled = true;
    }

    if (!ilce) return;

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';
        const res = await fetch(`${baseUrl}/adres/mahalleler?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}&kategori=${encodeURIComponent(category)}`);
        const mahalleler = await res.json();

        mahalleSelect.innerHTML = '<option value="">-- Mahalle Seçiniz --</option>';

        if (mahalleler && mahalleler.length > 0) {
            mahalleler.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                mahalleSelect.appendChild(opt);
            });
            mahalleSelect.disabled = false;
        } else {
            mahalleSelect.innerHTML = '<option value="">-- Kayıtlı Mahalle Bulunamadı --</option>';
        }
    } catch (err) {
        console.error("Mahalleler çekilemedi:", err);
    }
}

// 4. LOAD STREETS WHEN NEIGHBORHOOD IS SELECTED
async function adresMahalleDegisti() {
    const il = document.getElementById("searchIl").value;
    const ilce = document.getElementById("searchIlce").value;
    const mahalle = document.getElementById("searchMahalle").value;
    let category = document.getElementById("sel_search_type").value;
    if (category === "binas") category = "bina";

    const sokakSelect = document.getElementById("searchSokak");
    const binaSelect = document.getElementById("searchBina");

    sokakSelect.innerHTML = '<option value="">Yükleniyor...</option>';
    sokakSelect.disabled = true;
    if (binaSelect) {
        binaSelect.innerHTML = '<option value="">-- Önce Sokak Seçiniz --</option>';
        binaSelect.disabled = true;
    }

    if (!mahalle) return;

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';
        const res = await fetch(`${baseUrl}/adres/sokaklar?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}&mahalle=${encodeURIComponent(mahalle)}&kategori=${encodeURIComponent(category)}`);
        const sokaklar = await res.json();

        sokakSelect.innerHTML = '<option value="">-- Sokak / Cadde Seçiniz --</option>';

        if (sokaklar && sokaklar.length > 0) {
            sokaklar.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                sokakSelect.appendChild(opt);
            });
            sokakSelect.disabled = false;
        } else {
            sokakSelect.innerHTML = '<option value="">-- Kayıtlı Yol Bulunamadı --</option>';
        }
    } catch (err) {
        console.error("Sokaklar çekilemedi:", err);
    }
}

// 5. LOAD BUILDINGS WHEN STREET IS SELECTED
async function adresSokakDegisti() {
    console.log("adresSokakDegisti tetiklendi!");

    let category = document.getElementById("sel_search_type").value;
    if (category === "binas") category = "bina";

    if (category !== "bina") return;

    const il = document.getElementById("searchIl").value;
    const ilce = document.getElementById("searchIlce").value;
    const mahalle = document.getElementById("searchMahalle").value;
    const sokak = document.getElementById("searchSokak").value;
    const binaSelect = document.getElementById("searchBina");

    if (!binaSelect) return;

    binaSelect.innerHTML = '<option value="">Yükleniyor...</option>';
    binaSelect.disabled = true;

    if (!sokak) return;

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';
        const url = `${baseUrl}/adres/binalar?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}&mahalle=${encodeURIComponent(mahalle)}&sokak=${encodeURIComponent(sokak)}`;
        const res = await fetch(url);

        if (!res.ok) throw new Error("Binalar çekilemedi.");

        const binalar = await res.json();
        console.log("Gelen binalar:", binalar);

        binaSelect.innerHTML = '<option value="">-- Bina / No Seçiniz --</option>';

        if (binalar && binalar.length > 0) {
            binalar.forEach(bina => {
                const temizBinaObj = {
                    id: bina.id || bina.Id,
                    name: bina.name || bina.Name || "Bina",
                    type: bina.type || bina.Type || "",
                    boylam: parseFloat(bina.boylam || bina.Boylam || 0),
                    enlem: parseFloat(bina.enlem || bina.Enlem || 0),
                    city: il,
                    ilce: ilce,
                    mahalle: mahalle
                };

                const opt = document.createElement("option");
                opt.value = JSON.stringify(temizBinaObj);
                opt.textContent = `${temizBinaObj.name}`;
                binaSelect.appendChild(opt);
            });
            binaSelect.disabled = false;
        } else {
            binaSelect.innerHTML = '<option value="">-- Bu Sokakta Bina Yok --</option>';
        }
    } catch (err) {
        console.error("Binalar çekilirken hata:", err);
        binaSelect.innerHTML = '<option value="">Yüklenemedi</option>';
    }
}

// 6. SEARCH BY ADDRESS (ZOOMS TO BUILDING OR ROAD AND HIGHLIGHTS ON MAP)
async function adresliAra() {
    const category = document.getElementById("sel_search_type").value;

    // A) BUILDING SEARCH
    if (category === "binas" || category === "bina") {
        const binaVal = document.getElementById("searchBina").value;
        if (!binaVal) return alert("Lütfen haritada gidilecek Binayı seçiniz!");

        const bina = JSON.parse(binaVal);
        if (bina && !isNaN(bina.boylam) && !isNaN(bina.enlem)) {
            haritadaNoktayiVurgula(bina.boylam, bina.enlem, bina.name, `Bina (${bina.type || ''}) - ${bina.city}/${bina.ilce} ${bina.mahalle}`);
        }
    }
    // B) ROAD SEARCH
    else if (category === "yol") {
        const il = document.getElementById("searchIl").value;
        const ilce = document.getElementById("searchIlce").value;
        const mahalle = document.getElementById("searchMahalle").value;
        const sokak = document.getElementById("searchSokak").value;

        if (!il || !ilce || !mahalle) return alert("Lütfen en az İl, İlçe ve Mahalle seçiniz!");

        try {
            const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';

            const res = await fetch(`${baseUrl}/adres/yollar?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}&mahalle=${encodeURIComponent(mahalle)}`);
            const yollar = await res.json();

            if (!yollar || yollar.length === 0) {
                return alert("Seçilen adreste veritabanında yol verisi bulunamadı!");
            }

            let hedefYol = yollar[0];
            if (sokak) {
                const bulunan = yollar.find(y => (y.name || y.Name || "").toLowerCase().trim() === sokak.toLowerCase().trim());
                if (bulunan) hedefYol = bulunan;
            }

            const rawCoords = hedefYol.koordinat_Metni || hedefYol.koordinat_metni || hedefYol.Koordinat_Metni || hedefYol.koordinatMetni || "";

            if (rawCoords) {
                const coords = typeof metniKoordinataCevir === 'function' ? metniKoordinataCevir(rawCoords) : [];

                if (coords && coords.length > 0) {
                    const lng = parseFloat(coords[0][0]);
                    const lat = parseFloat(coords[0][1]);

                    if (!isNaN(lng) && !isNaN(lat)) {
                        haritadaNoktayiVurgula(lng, lat, (hedefYol.name || hedefYol.Name || "Yol"), `Yol/Sokak - ${hedefYol.city || il}/${hedefYol.ilce || ilce} ${hedefYol.mahalle || mahalle}`);
                    } else {
                        alert("Yol koordinatları geçersiz sayısal değer içeriyor.");
                    }
                } else {
                    alert("Yol koordinat metni ayrıştırılamadı.");
                }
            } else {
                alert("Bu yola ait koordinat verisi bulunamadı.");
            }
        } catch (err) {
            console.error("Yol konumlandırma hatası:", err);
            alert("Yol konumu alınırken bir sunucu hatası oluştu.");
        }
    }
}

// 7. HIGHLIGHT POINT ON MAP WITH CIRCULAR BOUNDARY, POPUP, AND MARKER
function haritadaNoktayiVurgula(lng, lat, baslik, detay, tur = "") {
    if (typeof map === 'undefined') return;

    let hedefZoom = 16.5;
    let daireYaricapKm = 0.3;

    const kontrolMetni = (tur + " " + detay + " " + baslik).toLowerCase();

    if (kontrolMetni.includes("bölge") || kontrolMetni.includes("coğrafi")) {
        hedefZoom = 6.5;
        daireYaricapKm = 80;
    } else if (kontrolMetni.includes("il") && !kontrolMetni.includes("ilçe")) {
        hedefZoom = 9.5;
        daireYaricapKm = 15;
    } else if (kontrolMetni.includes("nehir")) {
        hedefZoom = 8.5;
        daireYaricapKm = 10;
    }

    map.flyTo({ center: [lng, lat], zoom: hedefZoom, essential: true });

    if (map.getLayer(SEARCH_LAYER_ID)) map.removeLayer(SEARCH_LAYER_ID);
    if (map.getSource(SEARCH_SOURCE_ID)) map.removeSource(SEARCH_SOURCE_ID);
    if (currentSearchMarker) currentSearchMarker.remove();

    const circleGeoJSON = createGeoJSONCircle([lng, lat], daireYaricapKm);
    map.addSource(SEARCH_SOURCE_ID, {
        'type': 'geojson',
        'data': circleGeoJSON
    });

    map.addLayer({
        'id': SEARCH_LAYER_ID,
        'type': 'fill',
        'source': SEARCH_SOURCE_ID,
        'paint': {
            'fill-color': '#007bff',
            'fill-opacity': 0.25,
            'fill-outline-color': '#004085'
        }
    });

    const popupHtml = `
        <div style="text-align:center; padding: 4px; font-family: sans-serif;">
            <strong style="font-size:14px; color:#d9534f;">📍 ${baslik}</strong>
            <p style="margin: 2px 0 0 0; font-size:11px; color:#555;">${detay}</p>
        </div>
    `;

    currentSearchPopup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml);

    currentSearchMarker = new maplibregl.Marker({ color: '#d9534f' })
        .setLngLat([lng, lat])
        .setPopup(currentSearchPopup)
        .addTo(map);

    currentSearchMarker.togglePopup();
}

// 8. CLASSIC TEXT SEARCH FUNCTION
async function aramaYap() {
    const aramaTipi = document.getElementById("sel_search_type").value;
    const aramaMetni = document.getElementById("txt_search").value.trim().toLowerCase();

    if (!aramaMetni) {
        alert("Lütfen bir isim giriniz!");
        return;
    }

    const bolgeMerkezleri = {
        "karadeniz bölgesi": { lng: 36.5000, lat: 41.0000 },
        "iç anadolu bölgesi": { lng: 33.5000, lat: 39.0000 },
        "marmara bölgesi": { lng: 28.5000, lat: 40.5000 },
        "ege bölgesi": { lng: 28.0000, lat: 38.3000 },
        "akdeniz bölgesi": { lng: 32.5000, lat: 36.8000 },
        "doğu anadolu bölgesi": { lng: 41.5000, lat: 39.5000 },
        "güneydoğu anadolu bölgesi": { lng: 39.5000, lat: 37.5000 }
    };

    try {
        const baseUrl = typeof API_URL !== 'undefined' ? API_URL : 'https://localhost:7183/api';
        const response = await fetch(`${baseUrl}/katmanlar`);
        const data = await response.json();

        let bulunan = null;

        const iller = data.iller || data.Iller || [];
        const nehirler = data.nehirler || data.Nehirler || [];
        const bolgeler = data.bolgeler || data.Bolgeler || [];

        // A) SEARCH IN PROVINCES
        if (!bulunan && (aramaTipi === "all" || aramaTipi === "hepsi" || aramaTipi === "il")) {
            const il = iller.find(i => (i.name || i.Name || "").toLowerCase().includes(aramaMetni));
            if (il) {
                bulunan = {
                    adi: il.name || il.Name,
                    lng: parseFloat(il.boylam || il.Boylam),
                    lat: parseFloat(il.enlem || il.Enlem),
                    tur: "İl"
                };
            }
        }

        // B) SEARCH IN RIVERS
        if (!bulunan && (aramaTipi === "all" || aramaTipi === "hepsi" || aramaTipi === "nehir")) {
            const nehir = nehirler.find(n => (n.river_Name || n.river_name || n.name || "").toLowerCase().includes(aramaMetni));
            if (nehir) {
                const kMetni = nehir.koordinat_metni || nehir.koordinat_Metni || nehir.Koordinat_Metni || "";
                const coords = typeof metniKoordinataCevir === 'function' ? metniKoordinataCevir(kMetni) : [];
                if (coords.length > 0) {
                    bulunan = {
                        adi: nehir.river_Name || nehir.river_name || nehir.name,
                        lng: coords[0][0],
                        lat: coords[0][1],
                        tur: "Nehir"
                    };
                }
            }
        }

        // C) SEARCH IN REGIONS
        if (!bulunan && (aramaTipi === "all" || aramaTipi === "hepsi" || aramaTipi === "bolge" || aramaTipi === "bolgeler")) {
            const bolge = bolgeler.find(b => (b.area_Name || b.area_name || b.name || "").toLowerCase().includes(aramaMetni));
            if (bolge) {
                const bolgeAdiLower = (bolge.area_Name || bolge.area_name || bolge.name || "").toLowerCase().trim();

                let merkez = bolgeMerkezleri[bolgeAdiLower];

                if (!merkez) {
                    const kMetni = bolge.koordinat_metni || bolge.koordinat_Metni || bolge.Koordinat_Metni || "";
                    const coords = typeof metniKoordinataCevir === 'function' ? metniKoordinataCevir(kMetni) : [];
                    if (coords.length > 0) merkez = { lng: coords[0][0], lat: coords[0][1] };
                }

                if (merkez) {
                    bulunan = {
                        adi: bolge.area_Name || bolge.area_name || bolge.name,
                        lng: merkez.lng,
                        lat: merkez.lat,
                        tur: "Coğrafi Bölge"
                    };
                }
            }
        }

        if (bulunan && !isNaN(bulunan.lng) && !isNaN(bulunan.lat)) {
            haritadaNoktayiVurgula(bulunan.lng, bulunan.lat, bulunan.adi, bulunan.tur, bulunan.tur);
        } else {
            alert("Aramanıza uygun veri bulunamadı.");
        }
    } catch (err) {
        console.error("Arama hatası:", err);
        alert("Arama yapılırken bir hata oluştu.");
    }
}