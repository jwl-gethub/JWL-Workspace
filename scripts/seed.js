// Loads the starter data (real JWL staff/projects/tasks) into the database.
// Run once after the first deploy: `railway run npm run seed`
// Safe to re-run — it overwrites documents by id, it doesn't duplicate them.
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

(async () => {
  await db.init();
  const staff = await loadDir("staff");
  const projects = await loadDir("projects");
  const tasks = await loadDir("tasks");
  console.log(`Seeded ${staff} staff, ${projects} projects, ${tasks} tasks.`);
  await db.pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
