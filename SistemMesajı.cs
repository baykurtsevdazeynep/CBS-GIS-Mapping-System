using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("sistem_mesajlari")]
    public class SistemMesaji
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("mesaj_metni")]
        public string MesajMetni { get; set; } = string.Empty;

        [Column("zaman")]
        public DateTime Zaman { get; set; } = DateTime.UtcNow;
        [Column("hedef_kullanici")]
        public string? HedefKullanici { get; set; } 
    }
}