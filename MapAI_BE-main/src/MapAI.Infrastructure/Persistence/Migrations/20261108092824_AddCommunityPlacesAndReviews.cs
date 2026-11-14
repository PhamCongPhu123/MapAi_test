using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MapAI.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommunityPlacesAndReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUserContribution",
                table: "Locations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ModeratedAt",
                table: "Locations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModeratedById",
                table: "Locations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModerationNote",
                table: "Locations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Locations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedById",
                table: "Locations",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LocationReviews",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    LocationId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationReviews", x => x.Id);
                    table.CheckConstraint("CK_LocationReviews_Rating", "\"Rating\" BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_LocationReviews_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LocationReviews_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Locations_ModeratedById",
                table: "Locations",
                column: "ModeratedById");

            migrationBuilder.CreateIndex(
                name: "IX_Locations_Status_CreatedAt",
                table: "Locations",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Locations_SubmittedById",
                table: "Locations",
                column: "SubmittedById");

            migrationBuilder.CreateIndex(
                name: "IX_LocationReviews_LocationId_UserId",
                table: "LocationReviews",
                columns: new[] { "LocationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LocationReviews_UserId",
                table: "LocationReviews",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Locations_Users_ModeratedById",
                table: "Locations",
                column: "ModeratedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Locations_Users_SubmittedById",
                table: "Locations",
                column: "SubmittedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Locations_Users_ModeratedById",
                table: "Locations");

            migrationBuilder.DropForeignKey(
                name: "FK_Locations_Users_SubmittedById",
                table: "Locations");

            migrationBuilder.DropTable(
                name: "LocationReviews");

            migrationBuilder.DropIndex(
                name: "IX_Locations_ModeratedById",
                table: "Locations");

            migrationBuilder.DropIndex(
                name: "IX_Locations_Status_CreatedAt",
                table: "Locations");

            migrationBuilder.DropIndex(
                name: "IX_Locations_SubmittedById",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "IsUserContribution",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "ModeratedAt",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "ModeratedById",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "ModerationNote",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "SubmittedById",
                table: "Locations");
        }
    }
}
