// Aplica supabase/schema.sql vía conexión directa a Postgres.
// Corre en tu máquina (donde el puerto 5432 de Supabase sea alcanzable).
//
// Uso:
//   1. Copia .env.example -> .env y pega tu DIRECT_URL real (desde el dashboard de
//      Supabase: Project Settings -> Database -> Connection string -> URI).
//   2. npm install
//   3. npm run apply-schema
//
// Nota: Supabase exige SSL en la conexión directa.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import "dotenv/config";

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("ERROR: define DIRECT_URL en scripts/.env");
  process.exit(1);
}

const schemaPath = fileURLToPath(new URL("../supabase/schema.sql", import.meta.url));
const sql = readFileSync(schemaPath, "utf8");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Conectado. Aplicando schema...");
  await client.query(sql);
  console.log("✓ schema aplicado (perfiles, registros_diarios, checkins, alimentos + RLS)");
} catch (err) {
  console.error("✗ fallo:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
