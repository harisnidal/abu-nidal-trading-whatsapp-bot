import express from "express";
import path from "node:path";
import { env } from "./config";
import { webhookRouter } from "./webhook";
import { dashboardApiRouter } from "./dashboardApi";
import { basicAuth } from "./basicAuth";

const app = express();
app.use(express.json());

// WhatsApp webhook: no auth (Meta calls this; verify_token handles the GET check).
app.use(webhookRouter);

// Dashboard: protected by HTTP Basic Auth.
app.use("/dashboard", basicAuth, express.static(path.join(__dirname, "..", "public")));
app.use("/api", basicAuth, dashboardApiRouter);

app.get("/", (_req, res) => res.redirect("/dashboard"));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
  console.log(`Dashboard: http://localhost:${env.port}/dashboard`);
  console.log(`Webhook URL to give Meta: https://<your-domain>/webhook`);
});
