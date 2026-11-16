using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MapAI.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUnifiedOsmPlaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOsmReference",
                table: "Locations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                table: "Locations",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            // Backfill Vietnamese search keys without requiring the unaccent extension.
            migrationBuilder.Sql("""
                UPDATE "Locations" SET "NormalizedName" = trim(regexp_replace(
                    regexp_replace(normalize(translate(lower("Title"), 'đ', 'd'), NFD), U&'[\0300-\036f]', '', 'g'),
                    '[^a-z0-9]+', ' ', 'g'));
                """);

            migrationBuilder.CreateTable(
                name: "OsmPlaceReferences",
                columns: table => new
                {
                    CanonicalId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OsmType = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    OsmId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LocationId = table.Column<string>(type: "text", nullable: false),
                    VerifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OsmPlaceReferences", x => x.CanonicalId);
                    table.ForeignKey(
                        name: "FK_OsmPlaceReferences_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Locations_NormalizedName",
                table: "Locations",
                column: "NormalizedName");

            migrationBuilder.CreateIndex(
                name: "IX_OsmPlaceReferences_LocationId",
                table: "OsmPlaceReferences",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OsmPlaceReferences_OsmType_OsmId",
                table: "OsmPlaceReferences",
                columns: new[] { "OsmType", "OsmId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OsmPlaceReferences");

            migrationBuilder.DropIndex(
                name: "IX_Locations_NormalizedName",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "IsOsmReference",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                table: "Locations");
        }
    }
}
