// Test-only PostgreSQL/WASM. Auth/Storage schemas are minimal external-service stubs.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile, readdir } from "node:fs/promises";
const db = await PGlite.create();
await db.exec(await readFile("backend/tests/bootstrap.sql", "utf8"));
for (const name of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
}
const port = Number(process.env.TEST_DB_PORT || 55432);
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port, maxConnections: 4 });
await server.start();
console.log(`Test PostgreSQL ready on 127.0.0.1:${port} (Auth/Storage are stubs)`);
process.on("SIGINT", async () => { await server.stop(); await db.close(); process.exit(); });
