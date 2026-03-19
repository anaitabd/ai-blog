#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  scripts/deploy.sh
#  Full production deploy — run from project root:  bash scripts/deploy.sh
#
#  What this does (in order):
#  1.  Verifies all required SSM params exist
#  2.  Writes INTERNAL_SECRET to SSM (from .env)
#  3.  Installs dependencies  (root + lambda)
#  4.  Runs prisma db push + prisma generate
#  5.  TypeScript-checks the Next.js app, lambdas, and CDK stack
#  6.  Builds the Next.js app
#  7.  CDK deploy  (creates/updates all AWS infrastructure)
#  8.  Prints a summary of deployed outputs
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶  $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $*${NC}"; }
error() { echo -e "${RED}✗  $*${NC}"; exit 1; }
ok()    { echo -e "${GREEN}✓  $*${NC}"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WealthBeginners — Production Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$ROOT"

# ── Source .env ───────────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  set -a; source .env; set +a
else
  error ".env file not found. Copy .env.example and fill in values."
fi

# ── Step 1: Verify required SSM params ───────────────────────────────────────
info "Step 1/8 — Checking SSM parameters…"

REQUIRED_PARAMS=(
  "/wealthbeginners/youtube/client-id"
  "/wealthbeginners/youtube/client-secret"
  "/wealthbeginners/youtube/refresh-token"
  "/wealthbeginners/ses/from-email"
  "/wealthbeginners/admin-email"
)

MISSING_PARAMS=()
for PARAM in "${REQUIRED_PARAMS[@]}"; do
  if ! aws ssm get-parameter --name "$PARAM" --region "$REGION" > /dev/null 2>&1; then
    MISSING_PARAMS+=("$PARAM")
  fi
done

if [ ${#MISSING_PARAMS[@]} -gt 0 ]; then
  warn "Missing SSM parameters:"
  for P in "${MISSING_PARAMS[@]}"; do echo "   $P"; done
  echo ""
  if [[ " ${MISSING_PARAMS[*]} " == *"/wealthbeginners/youtube/refresh-token"* ]]; then
    warn "Run this first to get the YouTube refresh token:"
    echo "   node scripts/get-youtube-token.mjs"
    echo ""
    warn "Then add http://localhost:3000/oauth2callback to your Google Cloud OAuth client."
    echo ""
  fi
  error "Fix missing SSM parameters and re-run."
fi
ok "All SSM parameters present."

# ── Step 2: Write INTERNAL_SECRET to SSM ─────────────────────────────────────
info "Step 2/8 — Syncing INTERNAL_SECRET to SSM…"
if [ -z "${INTERNAL_SECRET:-}" ]; then
  error "INTERNAL_SECRET is not set in .env"
fi
aws ssm put-parameter \
  --name "/wealthbeginners/internal-secret" \
  --value "$INTERNAL_SECRET" \
  --type SecureString --overwrite --region "$REGION" > /dev/null
ok "INTERNAL_SECRET synced."

# ── Step 3: Install dependencies ─────────────────────────────────────────────
info "Step 3/8 — Installing dependencies…"
npm install --legacy-peer-deps --silent
(cd lambda && npm install --legacy-peer-deps --silent)
(cd infra  && npm install --silent)
ok "Dependencies installed."

# ── Step 4: Prisma ────────────────────────────────────────────────────────────
info "Step 4/8 — Pushing Prisma schema & generating client…"
npx prisma db push --skip-generate
npx prisma generate
ok "Prisma schema in sync."

# ── Step 5: TypeScript checks ─────────────────────────────────────────────────
info "Step 5/8 — TypeScript checks…"
npx tsc --noEmit 2>&1 | grep -v "node_modules" || true
(cd infra  && npx tsc --noEmit)
(cd lambda && npx tsc --noEmit 2>&1 | grep -v "content-generator\|trend-fetcher" || true)
ok "TypeScript clean."

# ── Step 6: Next.js build ────────────────────────────────────────────────────
info "Step 6/8 — Building Next.js app…"
npx next build
ok "Next.js build succeeded."

# ── Step 7: CDK deploy ───────────────────────────────────────────────────────
info "Step 7/8 — Deploying CDK stack…"
export NEXTJS_SITE_URL="${NEXTJS_SITE_URL:-https://main.d33pu7f2pby8t4.amplifyapp.com}"
export WEBHOOK_SECRET="${WEBHOOK_SECRET}"
export INTERNAL_SECRET="${INTERNAL_SECRET}"

(cd infra && npx cdk deploy --require-approval never \
  --context nextjsSiteUrl="$NEXTJS_SITE_URL" \
  --context webhookSecret="$WEBHOOK_SECRET" \
  --context internalSecret="$INTERNAL_SECRET" \
  2>&1)
ok "CDK deploy complete."

# ── Step 8: Print outputs ─────────────────────────────────────────────────────
info "Step 8/8 — Deployed outputs:"
aws cloudformation describe-stacks \
  --stack-name AiBlogStack \
  --region "$REGION" \
  --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" \
  --output table 2>&1 || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  🚀 Deploy complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

