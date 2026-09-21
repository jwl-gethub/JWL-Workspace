const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE || "";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn(
    "SESSION_SECRET is not set — using a random secret generated at startup. " +
    "Everyone will be signed out whenever this service restarts. Set SESSION_SECRET in Railway to avoid that."
  );
}
if (!ACCESS_CODE) {
  console.warn(
    "ACCESS_CODE is not set — the planner is reachable by anyone with the URL, with no password. " +
    "Set ACCESS_CODE in Railway before sharing the link outside the team."
  );
}

const COLLECTIONS = new Set(["staff", "projects", "tasks"]);
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

const app = express();
app.set("trust proxy", 1); // Railway sits behind a proxy; needed for secure cookies
app.use(express.json({ limit: "2mb" }));
app.use(
  session({
    name: "jwl_planner_sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

function requireAuth(req, res, next) {
  if (!ACCESS_CODE) return next(); // no code configured -> open access
  if (req.session && req.session.authed) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "not_authenticated" });
  return res.redirect("/login");
}

// ---- auth ----
app.get("/login", (req, res) => {
  if (!ACCESS_CODE || (req.session && req.session.authed)) return res.redirect("/");
  res.set("Content-Type", "text/html").send(loginPage(""));
});
app.post("/login", express.urlencoded({ extended: false }), (req, res) => {
  const code = (req.body && req.body.code) || "";
  if (!ACCESS_CODE || code === ACCESS_CODE) {
    req.session.authed = true;
    return res.redirect("/");
  }
  res.status(401).set("Content-Type", "text/html").send(loginPage("That code isn't right."));
});
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.use(requireAuth);
app.use(express.static(path.join(__dirname, "public")));

// ---- SSE ----
const clients = new Set();
app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders && res.flushHeaders();
  res.write(": connected\n\n");
  clients.add(res);
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (e) {
      /* ignore */
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
});
function broadcast(collection, id, data, deleted) {
  const payload = `event: change\ndata: ${JSON.stringify({ collection, id, data: data || null, deleted: !!deleted })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (e) {
      clients.delete(res);
    }
  }
}

// ---- REST API ----
app.get("/api/state", async (req, res) => {
  try {
    const [staff, projects, tasks] = await Promise.all([
      db.listCollection("staff"),
      db.listCollection("projects"),
      db.listCollection("tasks"),
    ]);
    res.json({ staff, projects, tasks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.put("/api/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(404).json({ error: "unknown_collection" });
  if (!ID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
  const data = req.body && typeof req.body === "object" ? req.body : {};
  try {
    await db.setDoc(collection, id, data);
    broadcast(collection, id, data, false);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.delete("/api/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(404).json({ error: "unknown_collection" });
  if (!ID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
  try {
    await db.deleteDoc(collection, id);
    broadcast(collection, id, null, true);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

function loginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jewellery With Love Planner</title>
<style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#F5F5F2;color:#1A1C22;
    display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#fff;border:1px solid #DEDED8;border-radius:12px;padding:32px;width:100%;max-width:340px;
    box-shadow:0 6px 24px rgba(20,22,28,.08)}
  h1{font-size:18px;margin:0 0 4px}
  p.sub{color:#7A8090;font-size:13px;margin:0 0 20px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #C7C7BF;border-radius:7px;font-size:15px;margin-bottom:12px}
  button{width:100%;padding:10px;border:0;border-radius:7px;background:#2B4C8C;color:#fff;font-weight:600;font-size:14px;cursor:pointer}
  .err{color:#B3261E;font-size:13px;margin:0 0 12px}
</style></head><body>
<div class="card">
  <h1>Jewellery With Love</h1>
  <p class="sub">Planner — enter the team access code</p>
  ${error ? `<p class="err">${error}</p>` : ""}
  <form method="post" action="/login">
    <input type="password" name="code" placeholder="Access code" autofocus>
    <button type="submit">Continue</button>
  </form>
</div>
</body></html>`;
}

db.init()
  .then(async () => {
    try {
      const { seedIfEmpty } = require("./scripts/seedLib");
      const result = await seedIfEmpty();
      if (result) {
        console.log(
          `First boot with an empty database — loaded starter data: ${result.staff} staff, ${result.projects} projects, ${result.tasks} tasks.`
        );
      }
    } catch (e) {
      console.error("Auto-seed check failed (continuing without it):", e);
    }
    app.listen(PORT, () => console.log(`JWL planner listening on :${PORT}`));
  })
  .catch((e) => {
    console.error("Failed to initialise database", e);
    process.exit(1);
  });
