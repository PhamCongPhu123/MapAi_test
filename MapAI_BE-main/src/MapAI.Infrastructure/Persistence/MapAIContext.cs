using Microsoft.EntityFrameworkCore;

using MapAI.Domain.Entities;

namespace MapAI.Infrastructure.Persistence
{
    public class MapAIContext : DbContext
    {
        public MapAIContext(DbContextOptions<MapAIContext> options) : base(options) { }

        public DbSet<UserEntity> Users { get; set; } = null!;
        public DbSet<AccountTokenEntity> AccountTokens { get; set; } = null!;
        public DbSet<LocationEntity> Locations { get; set; } = null!;
        public DbSet<LocationReviewEntity> LocationReviews { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<LocationEntity>(entity =>
            {
                entity.HasIndex(l => new { l.Status, l.CreatedAt });
                entity.HasOne(l => l.SubmittedBy).WithMany().HasForeignKey(l => l.SubmittedById).OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(l => l.ModeratedBy).WithMany().HasForeignKey(l => l.ModeratedById).OnDelete(DeleteBehavior.SetNull);
            });
            modelBuilder.Entity<LocationReviewEntity>(entity =>
            {
                entity.HasIndex(r => new { r.LocationId, r.UserId }).IsUnique();
                entity.HasOne(r => r.Location).WithMany().HasForeignKey(r => r.LocationId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
                entity.ToTable(t => t.HasCheckConstraint("CK_LocationReviews_Rating", "\"Rating\" BETWEEN 1 AND 5"));
            });

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
