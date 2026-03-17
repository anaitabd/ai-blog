#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AWS Full Setup Script
# Reads AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from .env,
# then bootstraps CDK, deploys the stack, and back-fills .env with outputs.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
CDK_OUTPUTS="$ROOT_DIR/cdk-outputs.json"

# ── 1. Load .env ─────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌  .env not found. Copy .env.example to .env and fill in your values."
  exit 1
fi

set -o allexport
# shellcheck disable=SC1091
source "$ENV_FILE"
set +o allexport

# ── 2. Validate required vars ─────────────────────────────────────────────────
: "${AWS_REGION:?AWS_REGION must be set in .env}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID must be set in .env}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY must be set in .env}"

# Guard against placeholder values
if [[ "$AWS_ACCESS_KEY_ID" == "your-access-key" || "$AWS_SECRET_ACCESS_KEY" == "your-secret-key" ]]; then
  echo "❌  Replace placeholder AWS credentials in .env before running this script."
  exit 1
fi

# ── 3. Configure AWS CLI ──────────────────────────────────────────────────────
echo "→ Configuring AWS credentials (profile: default)..."
aws configure set aws_access_key_id     "$AWS_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
aws configure set region                "$AWS_REGION"
aws configure set output                "json"

# Verify credentials
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✓ Authenticated — account: $ACCOUNT_ID  region: $AWS_REGION"

# ── 4. Enable Bedrock model access check (informational only) ─────────────────
MODEL_ID="${AWS_BEDROCK_MODEL_ID:-anthropic.claude-sonnet-4-5}"
echo "→ Bedrock model: $MODEL_ID"
echo "  (If you haven't already, enable model access in the AWS Bedrock console)"

# ── 5. Install infra dependencies ─────────────────────────────────────────────
echo ""
echo "→ Installing infra dependencies..."
cd "$ROOT_DIR/infra"
npm install --silent

# ── 6. CDK Bootstrap ──────────────────────────────────────────────────────────
echo ""
echo "→ Bootstrapping CDK environment aws://$ACCOUNT_ID/$AWS_REGION ..."
npx cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION" \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess

# ── 7. Deploy the stack ───────────────────────────────────────────────────────
echo ""
echo "→ Deploying AiBlogStack (this may take 5-10 minutes)..."
NEXTJS_SITE_URL="${NEXT_PUBLIC_SITE_URL:-}" \
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}" \
npx cdk deploy \
  --require-approval never \
  --outputs-file "$CDK_OUTPUTS"

echo "✓ Stack deployed."

# ── 8. Parse outputs and update .env ──────────────────────────────────────────
echo ""
echo "→ Updating .env with stack outputs..."

# Use Node.js to parse cdk-outputs.json (no jq / python dependency)
node - "$CDK_OUTPUTS" "$ENV_FILE" "$ACCOUNT_ID" "$AWS_REGION" <<'EOF'
const fs          = require('fs')
const { execSync } = require('child_process')

const [,, outputsFile, envFile, accountId, region] = process.argv
const outputs = JSON.parse(fs.readFileSync(outputsFile, 'utf8'))
const stack   = outputs['AiBlogStack'] ?? {}

function upsertEnv(content, key, value) {
  const re = new RegExp(`^${key}=.*`, 'm')
  const line = `${key}="${value}"`
  return re.test(content) ? content.replace(re, line) : content + `\n${line}`
}

let env = fs.readFileSync(envFile, 'utf8')

// ── CloudFront + S3 ──────────────────────────────────────────
const cdnRaw          = stack['ImagesCdnUrl']    ?? ''
const s3Bucket        = stack['ImagesBucketName'] ?? `ai-blog-images-${accountId}`
const cloudfrontDomain = cdnRaw.replace(/^https?:\/\//, '').replace(/\/$/, '')

if (cloudfrontDomain) {
  env = upsertEnv(env, 'CLOUDFRONT_DOMAIN', cloudfrontDomain)
  env = upsertEnv(env, 'AWS_S3_BUCKET',     s3Bucket)
  console.log(`  CLOUDFRONT_DOMAIN="${cloudfrontDomain}"`)
  console.log(`  AWS_S3_BUCKET="${s3Bucket}"`)
}

// ── State Machine + DynamoDB table ──────────────────────────────────────────
const stateMachineArn = stack['StateMachineArn'] ?? ''
const topicsTable     = stack['TopicsTableName'] ?? 'ai-blog-topics'
if (stateMachineArn) {
  env = upsertEnv(env, 'STATE_MACHINE_ARN', stateMachineArn)
  env = upsertEnv(env, 'TOPICS_TABLE',      topicsTable)
  console.log(`  STATE_MACHINE_ARN="${stateMachineArn}"`)
  console.log(`  TOPICS_TABLE="${topicsTable}"`)
}

// ── DATABASE_URL from RDS + Secrets Manager ──────────────────
const dbEndpoint  = stack['DbEndpoint']  ?? ''
const dbSecretArn = stack['DbSecretArn'] ?? ''

if (dbEndpoint && dbSecretArn) {
  try {
    const secretJson = execSync(
      `aws secretsmanager get-secret-value --secret-id "${dbSecretArn}" --region "${region}" --query SecretString --output text`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const secret = JSON.parse(secretJson.trim())
    const pass   = encodeURIComponent(secret.password)
    const dbUrl  = `postgresql://${secret.username}:${pass}@${dbEndpoint}:5432/aiblog`
    env = upsertEnv(env, 'DATABASE_URL', dbUrl)
    console.log(`  DATABASE_URL set (endpoint: ${dbEndpoint})`)
  } catch (e) {
    console.error('  ⚠  Could not fetch DB secret from Secrets Manager:', e.message)
  }
}

fs.writeFileSync(envFile, env)
EOF

# ── 9. Install lambda dependencies (for local testing) ────────────────────────
echo ""
echo "→ Installing lambda dependencies..."
cd "$ROOT_DIR/lambda"
npm install --silent

# ── 10. Run Prisma migrations ─────────────────────────────────────────────────
echo ""
echo "→ Running prisma db push..."
cd "$ROOT_DIR"
# Re-source .env so DATABASE_URL is available in the current shell
set -o allexport
# shellcheck disable=SC1091
source "$ENV_FILE"
set +o allexport
# Install root deps if needed
[ -d node_modules ] || npm install --silent
npm run db:push
echo "✓ Database schema pushed."

# ── 11. Seed DynamoDB topics ──────────────────────────────────────────────────
echo ""
read -r -p "→ Seed DynamoDB with initial topics now? [Y/n] " SEED_CONFIRM
SEED_CONFIRM="${SEED_CONFIRM:-Y}"
if [[ "$SEED_CONFIRM" =~ ^[Yy]$ ]]; then
  echo "  Invoking ai-blog-topic-seeder Lambda..."
  SEED_RESULT=$(aws lambda invoke \
    --function-name ai-blog-topic-seeder \
    --payload '{}' \
    --cli-binary-format raw-in-base64-out \
    /dev/stdout 2>/dev/null)
  echo "  $SEED_RESULT"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  AWS setup complete!                                  ║"
echo "║                                                          ║"
echo "║  Next steps:                                             ║"
echo "║   1. Run: npm run dev   ← local Next.js dev server       ║"
echo "║   2. Open: http://localhost:3000                          ║"
echo "║   3. Admin: http://localhost:3000/admin                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
