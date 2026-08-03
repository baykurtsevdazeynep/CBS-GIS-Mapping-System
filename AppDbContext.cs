using CBS_Harita.Models;
using Microsoft.EntityFrameworkCore;

namespace CBS_Harita.Models
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Il> Iller { get; set; }
        public DbSet<Nehir> Nehirler { get; set; }
        public DbSet<Bolge> Bolgeler { get; set; }
        public DbSet<KamuBina> KamuBinalari { get; set; }
        public DbSet<Yol> Yollar { get; set; }
        public DbSet<SilinenVeri> SilinenVeriler { get; set; }
        public DbSet<SistemMesaji> SistemMesajlari { get; set; }
        public DbSet<Kullanici> Kullanicilar { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

     
            modelBuilder.Entity<Il>().ToTable("iller");
            modelBuilder.Entity<Nehir>().ToTable("nehirler");
            modelBuilder.Entity<Bolge>().ToTable("bolgeler");
            modelBuilder.Entity<KamuBina>().ToTable("binalar");
            modelBuilder.Entity<Yol>().ToTable("yollar");
            modelBuilder.Entity<SistemMesaji>().ToTable("sistem_mesajlari");
            modelBuilder.Entity<Kullanici>().ToTable("kullanicilar");
        }
    }
}