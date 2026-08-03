using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBS_Harita.Models
{
    [Table("binalar")] 
    public class KamuBina
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)] 
        [Column("id")]
        public int Id { get; set; }

        [Column("name")]
        public string Name { get; set; } = "";

        [Column("type")]
        public string Type { get; set; } = "";

        [Column("boylam")]
        public double Boylam { get; set; }

        [Column("enlem")]
        public double Enlem { get; set; }

        [Column("ruhsat_dosya_yolu")]
        public string? RuhsatDosyaYolu { get; set; }

        [Column("status")]
        public int Status { get; set; }

        [Column("ekleme_tarihi")]
        public DateTime Ekleme_Tarihi { get; set; }

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

        [Column("sokak_cadde")]
        public string? SokakCadde { get; set; } 

        [Column("kapi_no")]
        public string? KapiNo { get; set; } 
    }
}