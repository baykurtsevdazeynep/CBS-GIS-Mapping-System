using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("kullanicilar")]
    public class Kullanici
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("kullanici_adi")]
        public string KullaniciAdi { get; set; } = string.Empty;

        [Column("sifre")]
        public string Sifre { get; set; } = string.Empty;

        [Column("ad_soyad")]
        public string AdSoyad { get; set; } = string.Empty;

        [Column("rol")]
        public string Rol { get; set; } = string.Empty; 

        [Column("sorumlu_bolge_sehir")]
        public string? SorumluBolgeSehir { get; set; } 
    }
}