import { Router } from "express";

const router = Router();
const permitted = new Set([
  "POST /v1/identity/auth/refresh",
  "POST /v1/identity/consumer/auth/phone/validate",
  "POST /v1/identity/consumer/auth/otp/request",
  "POST /v1/identity/consumer/auth/otp/verify",
  "POST /v1/identity/consumer/auth/register",
  "POST /v1/identity/consumer/auth/verify-otp",
  "POST /v1/identity/consumer/auth/login",
  "POST /v1/identity/consumer/auth/mfa/challenge",
  "POST /v1/identity/consumer/auth/mfa/recovery",
  "GET /v1/identity/consumer/me",
  "PUT /v1/identity/consumer/me",
]);

// Fixed, allowlisted development bridge, not an arbitrary/open URL proxy.
router.use(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(503).json({ code: "IDENTITY_HTTPS_REQUIRED" }); return;
  }
  const path = req.path;
  if (Object.keys(req.query).length || !permitted.has(`${req.method} ${path}`)) {
    res.status(404).json({ code: "IDENTITY_ROUTE_NOT_CONFIGURED" }); return;
  }
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept-Language": req.get("Accept-Language")?.startsWith("ar") ? "ar" : "en",
    };
    if (path === "/v1/identity/consumer/me" && req.get("Authorization")) {
      headers.Authorization = req.get("Authorization")!;
    }
    const upstream = await fetch(`https://nero.tap-360.com${path}`, {
      method: req.method, headers, redirect: "error",
      body: req.method === "GET" ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(25_000),
    });
    res.set("Cache-Control", "no-store");
    const type = upstream.headers.get("content-type");
    if (type) res.set("Content-Type", type);
    const retry = upstream.headers.get("retry-after");
    if (retry) res.set("Retry-After", retry);
    res.status(upstream.status).send(await upstream.text());
  } catch {
    // Never echo/log credentials, tokens or upstream request bodies.
    res.status(502).json({ code: "IDENTITY_UNAVAILABLE" });
  }
});
export default router;
