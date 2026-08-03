using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("iller")] 
    public class Il
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)] 
        [Column("id")]
        public int Id { get; set; }

        [Column("name")] 
        public string Name { get; set; } = string.Empty;

        [Column("boylam")]
        public double Boylam { get; set; }

        [Column("enlem")]
        public double Enlem { get; set; }

        [Column("population")] 
        public string? Population { get; set; }
        [Column("ekleme_tarihi")]
        public DateTime Ekleme_Tarihi { get; set; } = DateTime.Now;
    }
}