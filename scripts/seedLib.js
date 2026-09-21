// Shared seed logic used by both the CLI seed script and the server's
// auto-seed-on-first-boot check.
const fs = require("fs");
const path = require("path");
const db = require("../db");

const DATA_DIR = path.join(__dirname, "seed-data");

async function loadDir(collection) {
  const dir = path.join(DATA_DIR, collection);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    await db.setDoc(collection, id, data);
  }
  return files.length;
}

async function runSeed() {
  const staff = await loadDir("staff");
  const projects = await loadDir("projects");
  const tasks = await loadDir("tasks");
  return { staff, projects, tasks };
}

// Only seeds if the database is empty (no staff yet). Safe to call on every
// boot — it's a no-op once real data exists, so it never overwrites work the
// team has done.
async function seedIfEmpty() {
  const existing = await db.listCollection("staff");
  if (existing.length > 0) return null;
  return runSeed();
}

module.exports = { runSeed, seedIfEmpty };
