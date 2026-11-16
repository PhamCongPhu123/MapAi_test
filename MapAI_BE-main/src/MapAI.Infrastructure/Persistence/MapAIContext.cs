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

        public DbSet<AccountFavoriteEntity> AccountFavorites { get; set; } = null!;
        public DbSet<SyncReceiptEntity> SyncReceipts { get; set; } = null!;

        public DbSet<OsmPlaceReferenceEntity> OsmPlaceReferences { get; set; } = null!;
        private void NormalizeNames()
        {
            foreach (var entry in ChangeTracker.Entries<LocationEntity>().Where(e => e.State is EntityState.Added or EntityState.Modified))
                entry.Entity.NormalizedName = MapAI.Domain.Models.Places.UnifiedPlaceRules.Normalize(entry.Entity.Title);
        }
        public override int SaveChanges(bool acceptAllChangesOnSuccess) { NormalizeNames(); return base.SaveChanges(acceptAllChangesOnSuccess); }
        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default) { NormalizeNames(); return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken); }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<LocationEntity>(entity =>
            {
                entity.HasIndex(l => new { l.Status, l.CreatedAt });
                entity.HasIndex(l => l.NormalizedName);
                entity.Property(l => l.NormalizedName).HasMaxLength(512);
                entity.HasOne(l => l.SubmittedBy).WithMany().HasForeignKey(l => l.SubmittedById).OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(l => l.ModeratedBy).WithMany().HasForeignKey(l => l.ModeratedById).OnDelete(DeleteBehavior.SetNull);
            });
            modelBuilder.Entity<OsmPlaceReferenceEntity>(entity =>
            {
                entity.HasKey(r => r.CanonicalId); entity.Property(r => r.CanonicalId).HasMaxLength(64);
                entity.Property(r => r.OsmType).HasMaxLength(8); entity.Property(r => r.OsmId).HasMaxLength(20);
                entity.HasIndex(r => new { r.OsmType, r.OsmId }).IsUnique();
                entity.HasOne(r => r.Location).WithMany(l => l.OsmReferences).HasForeignKey(r => r.LocationId).OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<LocationReviewEntity>(entity =>
            {
                entity.HasIndex(r => new { r.LocationId, r.UserId }).IsUnique();
                entity.HasOne(r => r.Location).WithMany().HasForeignKey(r => r.LocationId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
                entity.ToTable(t => t.HasCheckConstraint("CK_LocationReviews_Rating", "\"Rating\" BETWEEN 1 AND 5"));
            });

            modelBuilder.Entity<AccountFavoriteEntity>(entity =>
            {
                entity.HasKey(f => new { f.UserId, f.PlaceKey });
                entity.Property(f => f.PlaceKey).HasMaxLength(200);
                entity.HasOne<UserEntity>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<SyncReceiptEntity>(entity =>
            {
                entity.HasKey(r => new { r.UserId, r.OperationId });
                entity.HasOne<UserEntity>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
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
