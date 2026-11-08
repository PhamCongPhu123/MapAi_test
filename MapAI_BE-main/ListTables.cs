using Npgsql;
using System;

var connectionString = "User Id=postgres.xtjxbdzqbrpfygchjnze;Database=postgres;Server=aws-1-ap-southeast-1.pooler.supabase.com;Password=NextAIqwerty@123;";

try
{
    using var conn = new NpgsqlConnection(connectionString);
    conn.Open();
    using var cmd = new NpgsqlCommand("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", conn);
    using var reader = cmd.ExecuteReader();
    Console.WriteLine("Existing tables in public schema:");
    while (reader.Read())
    {
        Console.WriteLine($"- {reader.GetString(0)}");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}
