using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("silinen_veriler")]
    public class SilinenVeri
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("katman_turu")]
        public string KatmanTuru { get; set; } = "";

        [Column("name")]
        public string Name { get; set; } = "";

        [Column("silinme_tarihi")]
        public DateTime SilinmeTarihi { get; set; } = DateTime.Now;
    }
}