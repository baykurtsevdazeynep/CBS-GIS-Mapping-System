using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CBS_Harita.Models;

namespace CBS_Harita.Controllers
{
    [Route("api")]
    [ApiController]
    public class MapApiController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MapApiController(AppDbContext context)
        {
            _context = context;
        }

        // ========================================================================= 
        // 1. GET ALL LAYERS (Only approved Status == 1 active records appear on map)
        // =========================================================================
        [HttpGet("katmanlar")]
        public async Task<IActionResult> GetKatmanlar()
        {
            try
            {
                var iller = await _context.Iller.AsNoTracking().ToListAsync();
                var nehirler = await _context.Nehirler.AsNoTracking().ToListAsync();
                var bolgeler = await _context.Bolgeler.AsNoTracking().ToListAsync();

                var yollar = await _context.Yollar
                    .AsNoTracking()
                    .Where(y => y.Status == 1)
                    .ToListAsync();

                var binalar = await _context.KamuBinalari
                    .AsNoTracking()
                    .Where(b => b.Status == 1)
                    .ToListAsync();

                return Ok(new { iller, nehirler, bolgeler, binalar, yollar });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = "Katmanlar yüklenirken hata oluştu: " + ex.Message });
            }
        }

        // =========================================================================
        // 2. ADD NEW LAYER / DATA (Auto-approves for Manager, sends to approval for Officer)
        // =========================================================================
        [HttpPost("katman/ekle")]
        public async Task<IActionResult> Ekle(
            [FromForm] string katmanTuru,
            [FromForm] string name,
            [FromForm] string detay,
            [FromForm] double boylam,
            [FromForm] double enlem,
            [FromForm] string? koordinatMetni,
            [FromForm] string? rol,
            [FromForm] string? ekleyenKullanici,
            [FromForm] string? city,
            [FromForm] string? ilce,
            [FromForm] string? mahalle,
            [FromForm] string? sokak,
            [FromForm] string? kapiNo,
            IFormFile? ruhsatDosyasi)
        {
            try
            {
                string tur = katmanTuru?.Trim().ToLower() ?? "";
                bool isMudur = (rol == "Mudur");
                int baslangicStatus = isMudur ? 1 : 0;

                if (tur == "kamubinasi" || tur == "kamubinalari" || tur == "kamu" || tur == "bina" || tur == "yapi")
                {
                    double duzgunBoylam = boylam;
                    double duzgunEnlem = enlem;

                    while (Math.Abs(duzgunBoylam) > 180) duzgunBoylam /= 10;
                    while (Math.Abs(duzgunEnlem) > 90) duzgunEnlem /= 10;

                    var yeniBina = new KamuBina
                    {
                        Name = string.IsNullOrWhiteSpace(name) ? "Yapı / Bina" : name.Trim(),
                        Type = string.IsNullOrWhiteSpace(detay) ? "Yapı / Bina" : detay.Trim(),
                        Boylam = Math.Round(duzgunBoylam, 6),
                        Enlem = Math.Round(duzgunEnlem, 6),
                        Status = baslangicStatus,
                        Ekleme_Tarihi = DateTime.UtcNow,
                        EkleyenKullanici = ekleyenKullanici,
                        City = city,
                        Ilce = ilce,
                        Mahalle = mahalle,
                        SokakCadde = sokak,
                        KapiNo = kapiNo
                    };

                    if (ruhsatDosyasi != null && ruhsatDosyasi.Length > 0)
                    {
                        var dosyaAdi = Guid.NewGuid().ToString() + Path.GetExtension(ruhsatDosyasi.FileName);
                        var klasorYolu = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");

                        if (!Directory.Exists(klasorYolu)) Directory.CreateDirectory(klasorYolu);

                        var dosyaTamYolu = Path.Combine(klasorYolu, dosyaAdi);
                        using (var stream = new FileStream(dosyaTamYolu, FileMode.Create))
                        {
                            await ruhsatDosyasi.CopyToAsync(stream);
                        }
                        yeniBina.RuhsatDosyaYolu = "/uploads/" + dosyaAdi;
                    }

                    _context.KamuBinalari.Add(yeniBina);
                    await _context.SaveChangesAsync();

                    string msg = isMudur ? $"'{yeniBina.Name}' veritabanına eklendi ve haritada yayınlandı!" : $"'{yeniBina.Name}' talebi müdür/bölge sorumlusu onayına gönderildi!";
                    return Ok(new { message = msg });
                }

                if (tur == "il")
                {
                    var yeniIl = new Il
                    {
                        Name = name,
                        Population = detay,
                        Boylam = Math.Round(boylam, 6),
                        Enlem = Math.Round(enlem, 6)
                    };
                    _context.Iller.Add(yeniIl);
                    await _context.SaveChangesAsync();
                    return Ok(new { message = $"'{name}' ili veritabanına eklendi!" });
                }

                if (tur == "nehir")
                {
                    var yeniNehir = new Nehir
                    {
                        River_Name = name,
                        Color = string.IsNullOrWhiteSpace(detay) ? "#0284c7" : detay,
                        Koordinat_Metni = koordinatMetni ?? ""
                    };
                    _context.Nehirler.Add(yeniNehir);
                    await _context.SaveChangesAsync();
                    return Ok(new { message = $"'{name}' nehri veritabanına eklendi!" });
                }

                if (tur == "yol" || tur == "yollar")
                {
                    var yeniYol = new Yol
                    {
                        Name = name,
                        Type = string.IsNullOrWhiteSpace(detay) ? "Otoyol" : detay,
                        Koordinat_Metni = koordinatMetni ?? "",
                        Status = baslangicStatus,
                        Ekleme_Tarihi = DateTime.UtcNow,
                        EkleyenKullanici = ekleyenKullanici,
                        City = city,
                        Ilce = ilce,
                        Mahalle = mahalle
                    };

                    if (ruhsatDosyasi != null && ruhsatDosyasi.Length > 0)
                    {
                        var dosyaAdi = "yol_" + Guid.NewGuid().ToString() + Path.GetExtension(ruhsatDosyasi.FileName);
                        var klasorYolu = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");

                        if (!Directory.Exists(klasorYolu)) Directory.CreateDirectory(klasorYolu);

                        var dosyaTamYolu = Path.Combine(klasorYolu, dosyaAdi);
                        using (var stream = new FileStream(dosyaTamYolu, FileMode.Create))
                        {
                            await ruhsatDosyasi.CopyToAsync(stream);
                        }
                        yeniYol.RuhsatDosyaYolu = "/uploads/" + dosyaAdi;
                    }

                    _context.Yollar.Add(yeniYol);
                    await _context.SaveChangesAsync();

                    string msg = isMudur ? $"'{name}' yolu eklendi ve haritada yayınlandı!" : $"'{name}' yolu müdür/bölge sorumlusu onayına iletildi!";
                    return Ok(new { message = msg });
                }

                if (tur == "bolge" || tur == "bolgeler")
                {
                    var yeniBolge = new Bolge
                    {
                        Area_Name = name,
                        Fill_Color = string.IsNullOrWhiteSpace(detay) ? "#f8fafc" : detay,
                        Koordinat_Metni = koordinatMetni ?? ""
                    };
                    _context.Bolgeler.Add(yeniBolge);
                    await _context.SaveChangesAsync();
                    return Ok(new { message = $"'{name}' bölgesi veritabanına eklendi!" });
                }

                return BadRequest(new { error = $"Desteklenmeyen katman türü: '{katmanTuru}'" });
            }
            catch (Exception ex)
            {
                var detayHata = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { error = "Veritabanı Kayıt Hatası: " + detayHata });
            }
        }

        // =========================================================================
        // 3. DELETE / REMOVAL REQUEST (Manager deletes immediately, Officer sends for approval)
        // =========================================================================
        [HttpPost("katman/sil")]
        public async Task<IActionResult> SilmeTalebiOlustur([FromForm] string katmanTuru, [FromForm] int id, [FromForm] string? sebep, [FromForm] string? rol)
        {
            try
            {
                string tur = katmanTuru?.ToLower() ?? "";
                bool isMudur = (rol == "Mudur");

                if (tur == "kamubinasi" || tur == "kamu" || tur == "bina" || tur == "yapi")
                {
                    var bina = await _context.KamuBinalari.FindAsync(id);
                    if (bina == null) return NotFound(new { error = "Yapı/Bina bulunamadı." });

                    bina.Gerekce = sebep;
                    _context.KamuBinalari.Update(bina);
                }
                else if (tur == "yol" || tur == "yollar")
                {
                    var yol = await _context.Yollar.FindAsync(id);
                    if (yol == null) return NotFound(new { error = "Yol bulunamadı." });

                    yol.Gerekce = sebep;
                    _context.Yollar.Update(yol);
                }

                await _context.SaveChangesAsync();
                string mesaj = isMudur ? "Veri haritadan başarıyla kaldırıldı." : "Silme / kaldırma talebi Genel Müdüre iletildi.";
                return Ok(new { message = mesaj });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // =========================================================================
        // 4. UPDATE DATA
        // =========================================================================
        [HttpPut("katman/guncelle")]
        public async Task<IActionResult> Guncelle([FromBody] GuncelleModel model, [FromQuery] string rol = "SehirGorevlisi")
        {
            try
            {
                string tur = model.KatmanTuru?.Trim().ToLower() ?? "";

                if (rol == "Mudur")
                {
                    if (tur == "kamubinasi" || tur == "kamubinalari" || tur == "kamu" || tur == "bina" || tur == "yapi")
                    {
                        var bina = await _context.KamuBinalari.FindAsync(model.Id);
                        if (bina == null) return NotFound(new { error = "Yapı/Bina bulunamadı." });
                        if (!string.IsNullOrEmpty(model.Name)) bina.Name = model.Name;
                        if (!string.IsNullOrEmpty(model.Detay)) bina.Type = model.Detay;
                        _context.KamuBinalari.Update(bina);
                    }
                    else if (tur == "il")
                    {
                        var il = await _context.Iller.FindAsync(model.Id);
                        if (il == null) return NotFound(new { error = "İl bulunamadı." });
                        if (!string.IsNullOrEmpty(model.Name)) il.Name = model.Name;
                        if (!string.IsNullOrEmpty(model.Detay)) il.Population = model.Detay;
                        _context.Iller.Update(il);
                    }
                    else if (tur == "nehir")
                    {
                        var nehir = await _context.Nehirler.FindAsync(model.Id);
                        if (nehir == null) return NotFound(new { error = "Nehir bulunamadı." });
                        if (!string.IsNullOrEmpty(model.Name)) nehir.River_Name = model.Name;
                        if (!string.IsNullOrEmpty(model.Detay)) nehir.Color = model.Detay;
                        _context.Nehirler.Update(nehir);
                    }
                    else if (tur == "yol" || tur == "yollar")
                    {
                        var yol = await _context.Yollar.FindAsync(model.Id);
                        if (yol == null) return NotFound(new { error = "Yol bulunamadı." });
                        if (!string.IsNullOrEmpty(model.Name)) yol.Name = model.Name;
                        if (!string.IsNullOrEmpty(model.Detay)) yol.Type = model.Detay;
                        _context.Yollar.Update(yol);
                    }
                    else if (tur == "bolge" || tur == "bolgeler")
                    {
                        var bolge = await _context.Bolgeler.FindAsync(model.Id);
                        if (bolge == null) return NotFound(new { error = "Bölge bulunamadı." });
                        if (!string.IsNullOrEmpty(model.Name)) bolge.Area_Name = model.Name;
                        if (!string.IsNullOrEmpty(model.Detay)) bolge.Fill_Color = model.Detay;
                        _context.Bolgeler.Update(bolge);
                    }

                    await _context.SaveChangesAsync();
                    return Ok(new { message = "Güncelleme onaylandı ve veritabanı güncellendi!" });
                }
                else
                {
                    if (tur == "kamubinasi" || tur == "kamubinalari" || tur == "kamu" || tur == "bina" || tur == "yapi")
                    {
                        var bina = await _context.KamuBinalari.FindAsync(model.Id);
                        if (bina == null) return NotFound(new { error = "Yapı/Bina bulunamadı." });

                        string yeniAd = !string.IsNullOrEmpty(model.Name) ? model.Name : bina.Name;
                        string yeniDetay = !string.IsNullOrEmpty(model.Detay) ? model.Detay : bina.Type;

                        bina.Type = $"[Güncelleme Talebi] Yeni Ad: {yeniAd} | Yeni Tür: {yeniDetay}";
                        _context.KamuBinalari.Update(bina);
                    }
                    else if (tur == "il")
                    {
                        var il = await _context.Iller.FindAsync(model.Id);
                        if (il == null) return NotFound(new { error = "İl bulunamadı." });

                        string yeniAd = !string.IsNullOrEmpty(model.Name) ? model.Name : il.Name;
                        string yeniDetay = !string.IsNullOrEmpty(model.Detay) ? model.Detay : il.Population;

                        il.Population = $"[Güncelleme Talebi] Yeni Ad: {yeniAd} | Yeni Nüfus: {yeniDetay}";
                        _context.Iller.Update(il);
                    }
                    else if (tur == "nehir")
                    {
                        var nehir = await _context.Nehirler.FindAsync(model.Id);
                        if (nehir == null) return NotFound(new { error = "Nehir bulunamadı." });

                        string yeniAd = !string.IsNullOrEmpty(model.Name) ? model.Name : nehir.River_Name;
                        string yeniDetay = !string.IsNullOrEmpty(model.Detay) ? model.Detay : nehir.Color;

                        nehir.Color = $"[Güncelleme Talebi] Yeni Ad: {yeniAd} | Yeni Renk: {yeniDetay}";
                        _context.Nehirler.Update(nehir);
                    }
                    else if (tur == "yol" || tur == "yollar")
                    {
                        var yol = await _context.Yollar.FindAsync(model.Id);
                        if (yol == null) return NotFound(new { error = "Yol bulunamadı." });

                        string yeniAd = !string.IsNullOrEmpty(model.Name) ? model.Name : yol.Name;
                        string yeniDetay = !string.IsNullOrEmpty(model.Detay) ? model.Detay : yol.Type;

                        yol.Type = $"[Güncelleme Talebi] Yeni Ad: {yeniAd} | Yeni Tür: {yeniDetay}";
                        _context.Yollar.Update(yol);
                    }
                    else if (tur == "bolge" || tur == "bolgeler")
                    {
                        var bolge = await _context.Bolgeler.FindAsync(model.Id);
                        if (bolge == null) return NotFound(new { error = "Bölge bulunamadı." });

                        string yeniAd = !string.IsNullOrEmpty(model.Name) ? model.Name : bolge.Area_Name;
                        string yeniDetay = !string.IsNullOrEmpty(model.Detay) ? model.Detay : bolge.Fill_Color;

                        bolge.Fill_Color = $"[Güncelleme Talebi] Yeni Ad: {yeniAd} | Yeni Renk: {yeniDetay}";
                        _context.Bolgeler.Update(bolge);
                    }

                    await _context.SaveChangesAsync();
                    return Ok(new { message = "Düzenleme talebiniz başarıyla oluşturuldu, Genel Müdür onayına iletildi!" });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = "Güncelleme hatası: " + ex.Message });
            }
        }

        // =========================================================================
        // 5. MANAGER - PENDING APPROVAL REQUESTS (All Layers Included)
        // =========================================================================
        [HttpGet("katman/bekleyen-talepler")]
        public async Task<IActionResult> GetBekleyenTalepler([FromQuery] string rol = "Mudur")
        {
            try
            {
                var bekleyenBinalar = await _context.KamuBinalari.AsNoTracking()
                    .Where(b => b.Status != 2 && b.Status != 3 && (b.Status == 0 || !string.IsNullOrEmpty(b.Gerekce) || (b.Type != null && b.Type.Contains("[Güncelleme Talebi]"))))
                    .Select(b => new {
                        b.Id,
                        Name = b.Name ?? "",
                        Type = (b.Type != null && b.Type.Contains("[Güncelleme Talebi]")) ? "Düzenleme Talebi" : (string.IsNullOrEmpty(b.Type) ? "Yapı / Bina" : b.Type),
                        Gerekce = b.Gerekce ?? "",
                        KatmanTuru = "kamubinasi",
                        Ekleme_Tarihi = b.Ekleme_Tarihi,
                        RuhsatDosyaYolu = b.RuhsatDosyaYolu ?? "",
                        Boylam = (double?)b.Boylam,
                        Enlem = (double?)b.Enlem
                    })
                    .ToListAsync();

                var bekleyenYollar = await _context.Yollar.AsNoTracking()
                    .Where(y => y.Status != 2 && y.Status != 3 && (y.Status == 0 || !string.IsNullOrEmpty(y.Gerekce) || (y.Type != null && y.Type.Contains("[Güncelleme Talebi]"))))
                    .Select(y => new {
                        y.Id,
                        Name = y.Name ?? "",
                        Type = (y.Type != null && y.Type.Contains("[Güncelleme Talebi]")) ? "Düzenleme Talebi" : (string.IsNullOrEmpty(y.Type) ? "Otoyol / Yol" : y.Type),
                        Gerekce = y.Gerekce ?? "",
                        KatmanTuru = "yol",
                        Ekleme_Tarihi = y.Ekleme_Tarihi,
                        RuhsatDosyaYolu = y.RuhsatDosyaYolu ?? "",
                        Boylam = (double?)null,
                        Enlem = (double?)null
                    })
                    .ToListAsync();

                var tumTalepler = bekleyenBinalar.Cast<object>().Concat(bekleyenYollar.Cast<object>()).ToList();
                return Ok(tumTalepler);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // =========================================================================
        // 6. MANAGER - APPROVE REQUEST
        // =========================================================================
        [HttpPut("katman/onayla/{id}")]
        public async Task<IActionResult> Onayla(
            int id,
            [FromQuery] string rol,
            [FromQuery] string katmanTuru,
            [FromQuery] string? kullaniciBolge = "",
            [FromQuery] string? islemYapanAdSoyad = "Ahmet Yılmaz")
        {
            if (rol == "SehirSorumlusu" || rol == "Şehir Sorumlusu")
            {
                return Unauthorized(new { error = "Şehir sorumlularının onay yetkisi bulunmamaktadır!" });
            }

            string tur = katmanTuru?.Trim().ToLower() ?? "";
            string? hedefKullanici = null;
            string? talepSehri = null;

            try
            {
                if (tur == "kamubinasi" || tur == "kamubinalari" || tur == "kamu" || tur == "bina" || tur == "yapi")
                {
                    var bina = await _context.KamuBinalari.FirstOrDefaultAsync(b => b.Id == id);
                    if (bina == null) return NotFound(new { error = "Yapı/Bina bulunamadı." });

                    hedefKullanici = bina.EkleyenKullanici;
                    talepSehri = bina.City;

                    if (rol != "Mudur" && rol != "Müdür")
                    {
                        if (!BolgeSehirEslestir(kullaniciBolge, talepSehri))
                        {
                            return BadRequest(new { error = "Bu şehirdeki talebi onaylama yetkiniz bulunmamaktadır!" });
                        }
                    }

                    if (!string.IsNullOrEmpty(bina.Type) && bina.Type.Contains("[Güncelleme Talebi]"))
                    {
                        var parts = bina.Type.Split('|');
                        if (parts.Length == 2)
                        {
                            string yeniAd = parts[0].Replace("[Güncelleme Talebi] Yeni Ad:", "").Trim();
                            string yeniTur = parts[1].Replace("Yeni Tür:", "").Trim();

                            if (!string.IsNullOrEmpty(yeniAd)) bina.Name = yeniAd;
                            if (!string.IsNullOrEmpty(yeniTur)) bina.Type = yeniTur;
                        }
                        bina.Status = 1;
                    }
                    else if (!string.IsNullOrEmpty(bina.Gerekce))
                    {
                        bina.Status = 3;
                    }
                    else
                    {
                        bina.Status = 1;
                    }

                    bina.RetSebebi = null;
                    _context.KamuBinalari.Update(bina);
                }
                else if (tur == "yol" || tur == "yollar")
                {
                    var yol = await _context.Yollar.FirstOrDefaultAsync(y => y.Id == id);
                    if (yol == null) return NotFound(new { error = "Yol bulunamadı." });

                    hedefKullanici = yol.EkleyenKullanici;
                    talepSehri = yol.City;

                    if (rol != "Mudur" && rol != "Müdür")
                    {
                        if (!BolgeSehirEslestir(kullaniciBolge, talepSehri))
                        {
                            return BadRequest(new { error = "Bu şehirdeki talebi onaylama yetkiniz bulunmamaktadır!" });
                        }
                    }

                    if (!string.IsNullOrEmpty(yol.Type) && yol.Type.Contains("[Güncelleme Talebi]"))
                    {
                        var parts = yol.Type.Split('|');
                        if (parts.Length == 2)
                        {
                            string yeniAd = parts[0].Replace("[Güncelleme Talebi] Yeni Ad:", "").Trim();
                            string yeniTur = parts[1].Replace("Yeni Tür:", "").Trim();

                            if (!string.IsNullOrEmpty(yeniAd)) yol.Name = yeniAd;
                            if (!string.IsNullOrEmpty(yeniTur)) yol.Type = yeniTur;
                        }
                        yol.Status = 1;
                    }
                    else if (!string.IsNullOrEmpty(yol.Gerekce))
                    {
                        yol.Status = 3;
                    }
                    else
                    {
                        yol.Status = 1;
                    }

                    yol.RetSebebi = null;
                    _context.Yollar.Update(yol);
                }

                if (string.IsNullOrWhiteSpace(hedefKullanici))
                {
                    hedefKullanici = "Mehmet Demir";
                }

                string unvan = (rol == "Mudur" || rol == "Müdür") ? "Müdür" : "Bölge Sorumlusu";

                var yeniMesaj = new SistemMesaji
                {
                    MesajMetni = $"Talebiniz {unvan} Sayın {islemYapanAdSoyad} tarafından onaylandı.",
                    HedefKullanici = hedefKullanici,
                    Zaman = DateTime.Now
                };

                _context.SistemMesajlari.Add(yeniMesaj);

                await _context.SaveChangesAsync();
                return Ok(new { message = "Talep başarıyla onaylandı ve bildirim gönderildi!" });
            }
            catch (Exception ex)
            {
                var detay = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { error = "Backend Onay Hatası: " + detay });
            }
        }

        private bool BolgeSehirEslestir(string? bolge, string? sehir)
        {
            if (string.IsNullOrEmpty(bolge)) return false;
            if (string.IsNullOrEmpty(sehir)) return true;

            string MetniTemizle(string input)
            {
                var culture = new System.Globalization.CultureInfo("tr-TR");
                return input.ToLower(culture)
                            .Replace("i̇", "i")
                            .Replace("ı", "i")
                            .Replace("ş", "s")
                            .Replace("ğ", "g")
                            .Replace("ü", "u")
                            .Replace("ö", "o")
                            .Replace("ç", "c")
                            .Trim();
            }

            string b = MetniTemizle(bolge);
            string s = MetniTemizle(sehir);

            if (b.Contains("anadolu"))
            {
                return s.Contains("ankara") || s.Contains("konya") || s.Contains("eskisehir") ||
                       s.Contains("kayseri") || s.Contains("sivas") || s.Contains("kirikkale") ||
                       s.Contains("aksaray") || s.Contains("karaman") || s.Contains("anadolu");
            }

            if (b.Contains("ege"))
            {
                return s.Contains("izmir") || s.Contains("aydin") || s.Contains("mugla") ||
                       s.Contains("manisa") || s.Contains("denizli") || s.Contains("ege");
            }

            if (b.Contains("marmara"))
            {
                return s.Contains("istanbul") || s.Contains("bursa") || s.Contains("kocaeli") ||
                       s.Contains("sakarya") || s.Contains("marmara");
            }

            if (b.Contains("akdeniz"))
            {
                return s.Contains("antalya") || s.Contains("adana") || s.Contains("mersin") ||
                       s.Contains("hatay") || s.Contains("akdeniz");
            }

            return b.Contains(s) || s.Contains(b);
        }

        // =========================================================================
        // 7. MANAGER - REJECT REQUEST
        // =========================================================================
        [HttpPut("katman/reddet/{id}")]
        public async Task<IActionResult> Reddet(
            int id,
            [FromQuery] string rol,
            [FromQuery] string katmanTuru,
            [FromQuery] string? retSebebi = "Uygun görülmedi",
            [FromQuery] string? kullaniciBolge = "",
            [FromQuery] string? islemYapanAdSoyad = "Ahmet Yılmaz")
        {
            if (rol == "SehirSorumlusu" || rol == "Şehir Sorumlusu")
            {
                return Unauthorized(new { error = "Şehir sorumlularının talep reddetme yetkisi bulunmamaktadır!" });
            }

            string tur = katmanTuru?.Trim().ToLower() ?? "";
            string? hedefKullanici = null;
            string? talepSehri = null;

            try
            {
                if (tur == "kamubinasi" || tur == "kamubinalari" || tur == "kamu" || tur == "bina" || tur == "yapi")
                {
                    var bina = await _context.KamuBinalari.FirstOrDefaultAsync(b => b.Id == id);
                    if (bina == null) return NotFound(new { error = "Yapı/Bina bulunamadı." });

                    hedefKullanici = bina.EkleyenKullanici;
                    talepSehri = bina.City;

                    if (rol != "Mudur" && rol != "Müdür")
                    {
                        if (!BolgeSehirEslestir(kullaniciBolge, talepSehri))
                        {
                            return BadRequest(new { error = "Bu şehirdeki talebi reddetme yetkiniz bulunmamaktadır!" });
                        }
                    }

                    bina.Status = 2;
                    bina.RetSebebi = retSebebi;
                    _context.KamuBinalari.Update(bina);
                }
                else if (tur == "yol" || tur == "yollar")
                {
                    var yol = await _context.Yollar.FirstOrDefaultAsync(y => y.Id == id);
                    if (yol == null) return NotFound(new { error = "Yol bulunamadı." });

                    hedefKullanici = yol.EkleyenKullanici;
                    talepSehri = yol.City;

                    if (rol != "Mudur" && rol != "Müdür")
                    {
                        if (!BolgeSehirEslestir(kullaniciBolge, talepSehri))
                        {
                            return BadRequest(new { error = "Bu şehirdeki talebi reddetme yetkiniz bulunmamaktadır!" });
                        }
                    }

                    yol.Status = 2;
                    yol.RetSebebi = retSebebi;
                    _context.Yollar.Update(yol);
                }

                if (string.IsNullOrWhiteSpace(hedefKullanici))
                {
                    hedefKullanici = "Mehmet Demir";
                }

                string unvan = (rol == "Mudur" || rol == "Müdür") ? "Müdür" : "Bölge Sorumlusu";

                var yeniMesaj = new SistemMesaji
                {
                    MesajMetni = $"Talebiniz {unvan} Sayın {islemYapanAdSoyad} tarafından reddedildi. Neden: {retSebebi}",
                    HedefKullanici = hedefKullanici,
                    Zaman = DateTime.Now
                };

                _context.SistemMesajlari.Add(yeniMesaj);

                await _context.SaveChangesAsync();
                return Ok(new { message = "Talep reddedildi ve kullanıcıya bildirim gönderildi!" });
            }
            catch (Exception ex)
            {
                var detay = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { error = "Backend Reddetme Hatası: " + detay });
            }
        }

        // =========================================================================
        // 8. GET ADDED STRUCTURES
        // =========================================================================
        [HttpGet("katman/eklenenler")]
        public async Task<IActionResult> GetEklenenler([FromQuery] DateTime? baslangic, [FromQuery] DateTime? bitis)
        {
            try
            {
                var binaQuery = _context.KamuBinalari.AsNoTracking().Where(b => b.Status == 1);
                if (baslangic.HasValue) binaQuery = binaQuery.Where(b => b.Ekleme_Tarihi >= baslangic.Value.ToUniversalTime());
                if (bitis.HasValue)
                {
                    var bitisGunu = bitis.Value.Date.AddDays(1).AddTicks(-1).ToUniversalTime();
                    binaQuery = binaQuery.Where(b => b.Ekleme_Tarihi <= bitisGunu);
                }

                var eklenenBinalar = await binaQuery
                    .Select(b => new
                    {
                        b.Id,
                        Name = b.Name,
                        Type = string.IsNullOrWhiteSpace(b.Type) ? "Yapı / Bina" : b.Type,
                        KatmanTuru = "kamubinasi",
                        Ekleme_Tarihi = b.Ekleme_Tarihi,
                        b.Status
                    })
                    .ToListAsync();

                var yolQuery = _context.Yollar.AsNoTracking().Where(y => y.Status == 1);
                if (baslangic.HasValue) yolQuery = yolQuery.Where(y => y.Ekleme_Tarihi >= baslangic.Value.ToUniversalTime());
                if (bitis.HasValue)
                {
                    var bitisGunu = bitis.Value.Date.AddDays(1).AddTicks(-1).ToUniversalTime();
                    yolQuery = yolQuery.Where(y => y.Ekleme_Tarihi <= bitisGunu);
                }

                var eklenenYollar = await yolQuery
                    .Select(y => new
                    {
                        y.Id,
                        Name = y.Name,
                        Type = string.IsNullOrWhiteSpace(y.Type) ? "Yol / Otoyol" : y.Type,
                        KatmanTuru = "yol",
                        Ekleme_Tarihi = y.Ekleme_Tarihi,
                        y.Status
                    })
                    .ToListAsync();

                var hepsi = eklenenBinalar
                    .Concat(eklenenYollar)
                    .OrderByDescending(x => x.Ekleme_Tarihi)
                    .ToList();

                return Ok(hepsi);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = "Eklenen yapılar getirilirken hata oluştu: " + ex.Message });
            }
        }

        // =========================================================================
        // 9. GET BURNED AND DESTROYED STRUCTURES
        // =========================================================================
        [HttpGet("katman/silinenler")]
        public async Task<IActionResult> GetSilinenler([FromQuery] DateTime? baslangic, [FromQuery] DateTime? bitis)
        {
            try
            {
                var binaQuery = _context.KamuBinalari.AsNoTracking().Where(b => b.Status == 3 || b.Status == -1);

                if (baslangic.HasValue)
                    binaQuery = binaQuery.Where(b => b.Ekleme_Tarihi >= baslangic.Value.ToUniversalTime());

                if (bitis.HasValue)
                {
                    var bitisGunu = bitis.Value.Date.AddDays(1).AddTicks(-1).ToUniversalTime();
                    binaQuery = binaQuery.Where(b => b.Ekleme_Tarihi <= bitisGunu);
                }

                var silinenBinalar = await binaQuery
                    .Select(b => new
                    {
                        b.Id,
                        Name = b.Name,
                        Type = string.IsNullOrWhiteSpace(b.Type) ? "Yapı / Bina" : b.Type,
                        Sebep = b.Gerekce ?? b.Type,
                        KatmanTuru = "kamubinasi",
                        RuhsatDosyasi = b.RuhsatDosyaYolu,
                        Ekleme_Tarihi = b.Ekleme_Tarihi,
                        b.Status
                    })
                    .ToListAsync();

                var yolQuery = _context.Yollar.AsNoTracking().Where(y => y.Status == 3 || y.Status == -1);

                if (baslangic.HasValue)
                    yolQuery = yolQuery.Where(y => y.Ekleme_Tarihi >= baslangic.Value.ToUniversalTime());

                if (bitis.HasValue)
                {
                    var bitisGunu = bitis.Value.Date.AddDays(1).AddTicks(-1).ToUniversalTime();
                    yolQuery = yolQuery.Where(y => y.Ekleme_Tarihi <= bitisGunu);
                }

                var silinenYollar = await yolQuery
                    .Select(y => new
                    {
                        y.Id,
                        Name = y.Name,
                        Type = string.IsNullOrWhiteSpace(y.Type) ? "Yol / Otoyol" : y.Type,
                        Sebep = y.Gerekce ?? y.Type,
                        KatmanTuru = "yol",
                        RuhsatDosyasi = y.RuhsatDosyaYolu,
                        Ekleme_Tarihi = y.Ekleme_Tarihi,
                        y.Status
                    })
                    .ToListAsync();

                var hepsi = silinenBinalar
                    .Concat(silinenYollar)
                    .OrderByDescending(x => x.Ekleme_Tarihi)
                    .ToList();

                return Ok(hepsi);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = "Silinen yapılar getirilemedi: " + ex.Message });
            }
        }

        // === 10. GET SYSTEM MESSAGES ===
        [HttpGet("mesajlar")]
        public async Task<IActionResult> GetMesajlar([FromQuery] string? kullaniciAdi = "")
        {
            var query = _context.SistemMesajlari.AsNoTracking();

            if (!string.IsNullOrEmpty(kullaniciAdi))
            {
                query = query.Where(m => m.HedefKullanici == kullaniciAdi || string.IsNullOrEmpty(m.HedefKullanici));
            }

            var mesajlar = await query.OrderBy(m => m.Zaman).ToListAsync();
            return Ok(mesajlar);
        }

        // === 11. ADD SYSTEM MESSAGE ===
        [HttpPost("mesaj/ekle")]
        public async Task<IActionResult> MesajEkle([FromBody] MesajModel model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.Metin))
                    return BadRequest(new { error = "Mesaj metni boş olamaz." });

                var yeniMesaj = new SistemMesaji
                {
                    MesajMetni = model.Metin,
                    Zaman = DateTime.UtcNow
                };

                _context.SistemMesajlari.Add(yeniMesaj);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Mesaj kaydedildi." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = "Mesaj kaydedilemedi: " + ex.Message });
            }
        }

        // === DATABASE USER LOGIN ===
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginModel model)
        {
            var kullanici = await _context.Kullanicilar
                .AsNoTracking()
                .FirstOrDefaultAsync(k => k.KullaniciAdi == model.KullaniciAdi && k.Sifre == model.Sifre);

            if (kullanici == null)
                return Unauthorized(new { error = "Kullanıcı adı veya şifre hatalı!" });

            return Ok(new
            {
                id = kullanici.Id,
                kullaniciAdi = kullanici.KullaniciAdi,
                adSoyad = kullanici.AdSoyad,
                rol = kullanici.Rol,
                sorumluBolgeSehir = kullanici.SorumluBolgeSehir
            });
        }

        [HttpGet("adres/ilceler")]
        public async Task<IActionResult> GetIlceler([FromQuery] string il, [FromQuery] string? kategori)
        {
            if (string.IsNullOrWhiteSpace(il)) return Ok(new List<string>());
            var ilLower = il.Trim().ToLower();

            List<string> ilceler;

            if (kategori == "yol")
            {
                ilceler = await _context.Yollar.AsNoTracking()
                    .Where(y => y.City != null && y.City.ToLower() == ilLower && !string.IsNullOrEmpty(y.Ilce))
                    .Select(y => y.Ilce!)
                    .Distinct().OrderBy(x => x).ToListAsync();
            }
            else
            {
                ilceler = await _context.KamuBinalari.AsNoTracking()
                    .Where(b => b.City != null && b.City.ToLower() == ilLower && !string.IsNullOrEmpty(b.Ilce))
                    .Select(b => b.Ilce!)
                    .Distinct().OrderBy(x => x).ToListAsync();
            }

            return Ok(ilceler);
        }

        [HttpGet("adres/mahalleler")]
        public async Task<IActionResult> GetMahalleler([FromQuery] string il, [FromQuery] string ilce, [FromQuery] string? kategori)
        {
            if (string.IsNullOrWhiteSpace(il) || string.IsNullOrWhiteSpace(ilce)) return Ok(new List<string>());

            var ilLower = il.Trim().ToLower();
            var ilceLower = ilce.Trim().ToLower();

            List<string> mahalleler;

            if (kategori == "yol")
            {
                mahalleler = await _context.Yollar.AsNoTracking()
                    .Where(y => y.City != null && y.City.ToLower() == ilLower
                           && y.Ilce != null && y.Ilce.ToLower() == ilceLower
                           && !string.IsNullOrEmpty(y.Mahalle))
                    .Select(y => y.Mahalle!)
                    .Distinct().OrderBy(x => x).ToListAsync();
            }
            else
            {
                mahalleler = await _context.KamuBinalari.AsNoTracking()
                    .Where(b => b.City != null && b.City.ToLower() == ilLower
                           && b.Ilce != null && b.Ilce.ToLower() == ilceLower
                           && !string.IsNullOrEmpty(b.Mahalle))
                    .Select(b => b.Mahalle!)
                    .Distinct().OrderBy(x => x).ToListAsync();
            }

            return Ok(mahalleler);
        }

        [HttpGet("adres/yollar")]
        public async Task<IActionResult> GetAdresYollar([FromQuery] string il, [FromQuery] string ilce, [FromQuery] string mahalle)
        {
            if (string.IsNullOrWhiteSpace(il) || string.IsNullOrWhiteSpace(ilce) || string.IsNullOrWhiteSpace(mahalle))
                return Ok(new List<object>());

            var ilLower = il.Trim().ToLower();
            var ilceLower = ilce.Trim().ToLower();
            var mahalleLower = mahalle.Trim().ToLower();

            var yollar = await _context.Yollar.AsNoTracking()
                .Where(y => y.City != null && y.City.ToLower() == ilLower
                       && y.Ilce != null && y.Ilce.ToLower() == ilceLower
                       && y.Mahalle != null && y.Mahalle.ToLower() == mahalleLower)
                .Select(y => new {
                    y.Id,
                    Name = y.Name ?? "Yol",
                    Type = y.Type ?? "Otoyol",
                    y.Koordinat_Metni,
                    y.City,
                    y.Ilce,
                    y.Mahalle
                })
                .ToListAsync();

            return Ok(yollar);
        }

        [HttpGet("adres/sokaklar")]
        public async Task<IActionResult> GetSokaklar([FromQuery] string il, [FromQuery] string ilce, [FromQuery] string mahalle, [FromQuery] string? kategori)
        {
            if (string.IsNullOrWhiteSpace(il) || string.IsNullOrWhiteSpace(ilce) || string.IsNullOrWhiteSpace(mahalle)) return Ok(new List<string>());

            var ilLower = il.Trim().ToLower();
            var ilceLower = ilce.Trim().ToLower();
            var mahalleKok = mahalle.Trim().Split(' ')[0].ToLower();

            List<string> sokaklar;

            if (kategori == "yol")
            {
                sokaklar = await _context.Yollar.AsNoTracking()
                    .Where(y => y.City != null && y.City.ToLower() == ilLower
                           && y.Ilce != null && y.Ilce.ToLower() == ilceLower
                           && y.Mahalle != null && y.Mahalle.ToLower().Contains(mahalleKok)
                           && !string.IsNullOrEmpty(y.Name))
                    .Select(y => y.Name!)
                    .Distinct().OrderBy(x => x).ToListAsync();
            }
            else
            {
                sokaklar = await _context.KamuBinalari.AsNoTracking()
                    .Where(b => b.City != null && b.City.ToLower() == ilLower
                           && b.Ilce != null && b.Ilce.ToLower() == ilceLower
                           && b.Mahalle != null && b.Mahalle.ToLower().Contains(mahalleKok)
                           && !string.IsNullOrEmpty(b.SokakCadde))
                    .Select(b => b.SokakCadde!)
                    .Distinct().OrderBy(x => x).ToListAsync();
            }

            return Ok(sokaklar);
        }

        [HttpGet("adres/binalar")]
        public async Task<IActionResult> GetAdresBinalar([FromQuery] string il, [FromQuery] string ilce, [FromQuery] string mahalle, [FromQuery] string sokak)
        {
            if (string.IsNullOrWhiteSpace(il) || string.IsNullOrWhiteSpace(ilce) || string.IsNullOrWhiteSpace(mahalle))
                return Ok(new List<object>());

            var query = _context.KamuBinalari.AsNoTracking()
                .Where(b => b.City != null && b.City.ToLower() == il.Trim().ToLower()
                       && b.Ilce != null && b.Ilce.ToLower() == ilce.Trim().ToLower()
                       && b.Mahalle != null && b.Mahalle.ToLower() == mahalle.Trim().ToLower());

            if (!string.IsNullOrWhiteSpace(sokak))
            {
                query = query.Where(b => b.SokakCadde != null && b.SokakCadde.ToLower() == sokak.Trim().ToLower());
            }

            var binalar = await query
                .Select(b => new {
                    b.Id,
                    Name = b.Name ?? "Bina",
                    Type = b.Type ?? "Kamu",
                    b.Boylam,
                    b.Enlem,
                    b.City,
                    b.Ilce,
                    b.Mahalle,
                    b.SokakCadde,
                    b.KapiNo
                })
                .ToListAsync();

            return Ok(binalar);
        }

    }

    // =========================================================================
    // DTO MODEL CLASSES
    // =========================================================================
    public class GuncelleModel
    {
        public string KatmanTuru { get; set; } = "";
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Detay { get; set; } = "";
    }

    public class YikimYolTalebiModel
    {
        public string KatmanTuru { get; set; } = "";
        public int Id { get; set; }
        public string? DurumTuru { get; set; }
        public string? Sebep { get; set; }
    }

    public class ReddetModel
    {
        public string Sebep { get; set; } = "";
    }

    public class MesajModel
    {
        public string Metin { get; set; } = "";
    }

    public class LoginModel
    {
        public string KullaniciAdi { get; set; } = "";
        public string Sifre { get; set; } = "";
    }
}
