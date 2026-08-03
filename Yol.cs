using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("yollar")]
    public class Yol
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("name")]
        public string Name { get; set; } = "";

        [Column("type")]
        public string Type { get; set; } = "";

        [Column("koordinat_metni")]
        public string Koordinat_Metni { get; set; } = "";

        [Column("status")] 
        public int Status { get; set; } = 1;

        [Column("ekleme_tarihi")]
        public DateTime Ekleme_Tarihi { get; set; } = DateTime.Now;

        [Column("ruhsatdosyayolu")]
        public string? RuhsatDosyaYolu { get; set; }

        
        [Column("ret_sebebi")]
        public string? RetSebebi { get; set; }

        [Column("gerekce")]
        public string? Gerekce { get; set; }
        [Column("ekleyen_kullanici")]
        public string? EkleyenKullanici { get; set; }

        [Column("city")]
        public string? City { get; set; }

        [Column("ilce")]
        public string? Ilce { get; set; } 

        [Column("mahalle")]
        public string? Mahalle { get; set; } 
    }
}