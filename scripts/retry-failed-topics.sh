#!/bin/bash
# Retry failed topics in the AI blog pipeline
# Usage: ./retry-failed-topics.sh

set -e

REGION="us-east-1"
TABLE_NAME="ai-blog-topics"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   AI Blog Pipeline - Retry Failed Topics             ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Failed topic IDs from the JSON data
FAILED_TOPICS=(
  "231dc707-0e44-4307-a2ba-6fbfa19b562a"  # how to start investing with little money (ngrok)
  "38fda82e-3dbc-47b0-8d15-726a49ffd3a9"  # how to improve credit score 100 points (ngrok)
  "4aa18ea9-a2c7-4829-a699-6deb668a122c"  # how to budget money on low income (JSON parse)
  "479eef2d-46d5-43a5-b71b-4bb1bda7b56b"  # how to budget money on low income (JSON parse)
)

echo -e "${YELLOW}Found ${#FAILED_TOPICS[@]} failed topics to retry${NC}"
echo ""

for TOPIC_ID in "${FAILED_TOPICS[@]}"; do
  echo -e "${YELLOW}Processing topic: ${TOPIC_ID}${NC}"

  # Get current topic details
  KEYWORD=$(aws dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key "{\"id\":{\"S\":\"$TOPIC_ID\"}}" \
    --region "$REGION" \
    --query 'Item.keyword.S' \
    --output text 2>/dev/null || echo "unknown")

  echo -e "  Keyword: ${GREEN}${KEYWORD}${NC}"

  # Reset topic to PENDING status
  echo -n "  Resetting to PENDING... "
  aws dynamodb update-item \
    --table-name "$TABLE_NAME" \
    --key "{\"id\":{\"S\":\"$TOPIC_ID\"}}" \
    --update-expression "SET #s = :status, processingAt = :null, processedAt = :null, failReason = :null, currentStep = :null" \
    --expression-attribute-names '{"#s":"status"}' \
    --expression-attribute-values '{":status":{"S":"PENDING"},":null":{"NULL":true}}' \
    --region "$REGION" \
    >/dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Success${NC}"
  else
    echo -e "${RED}✗ Failed${NC}"
  fi

  echo ""
done

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All failed topics have been reset to PENDING       ║${NC}"
echo -e "${GREEN}║   They will be picked up in the next scheduled run   ║${NC}"
echo -e "${GREEN}║   Next runs: 7am, 1pm, 7pm UTC daily                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}To trigger immediately, run:${NC}"
echo -e "  aws lambda invoke --function-name ai-blog-topic-picker --region $REGION /tmp/picker-output.json"
echo ""

