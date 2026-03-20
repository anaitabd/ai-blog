#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  setup-youtube-ssm.sh
#  Stores YouTube OAuth2 credentials in AWS SSM Parameter Store (SecureString).
#  Run this ONCE locally before deploying.
#
#  Prerequisites:
#    - AWS CLI configured (aws configure or env vars)
#    - Your YouTube OAuth2 credentials from Google Cloud Console
#    - A valid refresh_token obtained via OAuth Playground:
#        1. Go to https://developers.google.com/oauthplayground
#        2. Click ⚙ → "Use your own OAuth credentials"
#        3. Enter client_id + client_secret from your OAuth JSON
#        4. Authorize scopes:
#             https://www.googleapis.com/auth/youtube.upload
#             https://www.googleapis.com/auth/youtube.readonly
#        5. Click "Exchange authorization code for tokens"
#        6. Copy the refresh_token value and set YOUTUBE_REFRESH_TOKEN below
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

# ── Fill these in (or export them before running) ────────────────────────────
YOUTUBE_CLIENT_ID="${YOUTUBE_CLIENT_ID:-557645947933-0j2jhhesm60qm0lqlp8mmuufv4aledb2.apps.googleusercontent.com}"
YOUTUBE_CLIENT_SECRET="${YOUTUBE_CLIENT_SECRET:-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}"
YOUTUBE_REFRESH_TOKEN="${YOUTUBE_REFRESH_TOKEN:-}"   # ← paste your refresh token here

if [[ -z "$YOUTUBE_REFRESH_TOKEN" ]]; then
  echo "❌  YOUTUBE_REFRESH_TOKEN is not set."
  echo ""
  echo "  Steps to get it:"
  echo "  1. Open https://developers.google.com/oauthplayground"
  echo "  2. Click ⚙ → 'Use your own OAuth credentials'"
  echo "  3. Client ID : $YOUTUBE_CLIENT_ID"
  echo "  4. Authorize: youtube.upload + youtube.readonly"
  echo "  5. Exchange auth code → copy refresh_token"
  echo "  6. Re-run:  YOUTUBE_REFRESH_TOKEN='your_token' bash scripts/setup-youtube-ssm.sh"
  exit 1
fi

echo "📦  Writing YouTube credentials to SSM (region: $REGION)..."

aws ssm put-parameter \
  --region "$REGION" \
  --name "/wealthbeginners/youtube/client-id" \
  --value "$YOUTUBE_CLIENT_ID" \
  --type "SecureString" \
  --overwrite \
  --no-cli-pager

echo "  ✓  /wealthbeginners/youtube/client-id"

aws ssm put-parameter \
  --region "$REGION" \
  --name "/wealthbeginners/youtube/client-secret" \
  --value "$YOUTUBE_CLIENT_SECRET" \
  --type "SecureString" \
  --overwrite \
  --no-cli-pager

echo "  ✓  /wealthbeginners/youtube/client-secret"

aws ssm put-parameter \
  --region "$REGION" \
  --name "/wealthbeginners/youtube/refresh-token" \
  --value "$YOUTUBE_REFRESH_TOKEN" \
  --type "SecureString" \
  --overwrite \
  --no-cli-pager

echo "  ✓  /wealthbeginners/youtube/refresh-token"
echo ""
echo "✅  All YouTube SSM parameters stored successfully."
echo ""
echo "Next steps:"
echo "  1. In AWS Amplify Console → App settings → Environment variables, add:"
echo "       YOUTUBE_CLIENT_ID     = $YOUTUBE_CLIENT_ID"
echo "       YOUTUBE_CLIENT_SECRET = (your secret)"
echo "  2. Redeploy your Amplify app to pick up the new env vars."
