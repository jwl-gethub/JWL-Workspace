// Loads the starter data (real JWL staff/projects/tasks) into the database.
// Run once after the first deploy: `railway run npm run seed`
// Safe to re-run — it overwrites documents by id, it doesn't duplicate them.
const db = require("../db");
const { runSeed } = require("./seedLib");

(async () => {
  await db.init();
  const { staff, projects, tasks } = await runSeed();
  console.log(`Seeded ${staff} staff, ${projects} projects, ${tasks} tasks.`);
  await db.pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
