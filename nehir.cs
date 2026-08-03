using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("nehirler")]
    public class Nehir
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)] 
        [Column("id")]
        public int Id { get; set; }

        [Column("river_name")]
        public string River_Name { get; set; } = string.Empty;

        [Column("color")]
        public string Color { get; set; } = "#0284c7";

        [Column("koordinat_metni")]
        public string Koordinat_Metni { get; set; } = string.Empty;
        [Column("ekleme_tarihi")]
        public DateTime Ekleme_Tarihi { get; set; } = DateTime.Now;
    }
}