using Microsoft.EntityFrameworkCore;

namespace MapAI.Domain.Entities
{
    public class MapAIContext : DbContext
    {
        public MapAIContext(DbContextOptions<MapAIContext> options) : base(options) { }

        public DbSet<UserEntity> Users { get; set; } = null!;
        public DbSet<AccountTokenEntity> AccountTokens { get; set; } = null!;
        public DbSet<LocationEntity> Locations { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<UserEntity>(entity =>
            {
                entity.HasIndex(e => e.Email).IsUnique();
            });

            modelBuilder.Entity<AccountTokenEntity>(entity =>
            {
                entity.HasOne(d => d.User)
                    .WithMany()
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
