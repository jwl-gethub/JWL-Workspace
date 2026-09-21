const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add a Postgres database to this Railway service.");
  process.exit(1);
}

// Railway's Postgres works over plain TCP on the private network and via its
// public proxy; neither needs certificate verification for this use case.
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      collection text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (collection);`);
}

async function listCollection(collection) {
  const { rows } = await pool.query(
    "SELECT id, data FROM documents WHERE collection = $1 ORDER BY id",
    [collection]
  );
  return rows;
}

async function setDoc(collection, id, data) {
  await pool.query(
    `INSERT INTO documents (collection, id, data, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (collection, id) DO UPDATE SET data = $3, updated_at = now()`,
    [collection, id, data]
  );
}

async function deleteDoc(collection, id) {
  await pool.query("DELETE FROM documents WHERE collection = $1 AND id = $2", [collection, id]);
}

module.exports = { pool, init, listCollection, setDoc, deleteDoc };
