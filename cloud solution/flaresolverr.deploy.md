# FlareSolverr on Railway
# Drag this file into your Railway project as a new service config,
# or use the template at: https://railway.app/template/flaresolverr

# ── railway.json (place in a /flaresolverr directory or as a separate Railway service) ──

{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": null,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}

# ── Dockerfile ────────────────────────────────────────────────────────────────
# Create this as flaresolverr/Dockerfile in your repo, OR just use the
# Railway template which pulls the image directly.

FROM ghcr.io/flaresolverr/flaresolverr:latest

ENV LOG_LEVEL=info
ENV LOG_HTML=false
ENV CAPTCHA_SOLVER=none
ENV TZ=UTC

EXPOSE 8191

# ── Environment variables to set in Railway ───────────────────────────────────
# LOG_LEVEL=info
# PORT=8191   (Railway sets this automatically)

# ── How to connect your backend to FlareSolverr ───────────────────────────────
# On Railway, services in the same project share an internal network.
# Set in your backend service:
#   FLARESOLVERR_URL=http://<flaresolverr-service-name>.railway.internal:8191/v1
#
# The .railway.internal hostname is only available inside Railway's private network.
# Replace <flaresolverr-service-name> with whatever you named the service.

# ── Alternative: Render.com ───────────────────────────────────────────────────
# On Render, use a Web Service with Docker:
#   Image URL: ghcr.io/flaresolverr/flaresolverr:latest
#   Port: 8191
# Then set FLARESOLVERR_URL to the Render internal URL or public URL.

# ── Test that it's working ────────────────────────────────────────────────────
# curl http://localhost:8191/v1 -H 'Content-Type: application/json'
# Expected: {"msg":"FlareSolverr is ready!","version":"...","userAgent":"..."}
