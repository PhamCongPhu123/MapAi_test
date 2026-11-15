using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MapAI.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountFavorites",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    PlaceKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SnapshotJson = table.Column<string>(type: "text", nullable: false),
                    Deleted = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountFavorites", x => new { x.UserId, x.PlaceKey });
                    table.ForeignKey(
                        name: "FK_AccountFavorites_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SyncReceipts",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    OperationId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestHash = table.Column<string>(type: "text", nullable: false),
                    ResultJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncReceipts", x => new { x.UserId, x.OperationId });
                    table.ForeignKey(
                        name: "FK_SyncReceipts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountFavorites");

            migrationBuilder.DropTable(
                name: "SyncReceipts");
        }
    }
}
