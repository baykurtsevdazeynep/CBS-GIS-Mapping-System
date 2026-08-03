using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("bolgeler")]
    public class Bolge
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)] 
        [Column("id")]
        public int Id { get; set; }

        [Column("area_name")]
        public string Area_Name { get; set; } = string.Empty;

        [Column("fill_color")]
        public string Fill_Color { get; set; } = "#f8fafc";

        [Column("koordinat_metni")]
        public string Koordinat_Metni { get; set; } = string.Empty;
        [Column("ekleme_tarihi")]
        public DateTime Ekleme_Tarihi { get; set; } = DateTime.Now;
    }
}