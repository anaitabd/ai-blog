#!/usr/bin/env node
// Reset all FAILED topics (and stale PENDING-with-failReason) in DynamoDB back to clean PENDING.
// Usage:  node scripts/reset-failed-topics.js
//         node scripts/reset-failed-topics.js --dry-run

const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb')
require('dotenv').config()

const DRY_RUN = process.argv.includes('--dry-run')
const REGION  = process.env.AWS_REGION ?? process.env.REGION ?? 'us-east-1'
const TABLE   = process.env.TOPICS_TABLE ?? 'ai-blog-topics'

const dynamo = new DynamoDBClient({ region: REGION })

/** Paginated scan — collects ALL matching items regardless of table size. */
async function scanAll(params) {
  const items = []
  let lastKey
  do {
    const res = await dynamo.send(new ScanCommand({ ...params, ExclusiveStartKey: lastKey }))
    items.push(...(res.Items ?? []))
    lastKey = res.LastEvaluatedKey
  } while (lastKey)
  return items
}

async function main() {
  console.log(`\n🔍 Scanning ${TABLE} for FAILED / stale PENDING topics…${DRY_RUN ? ' (dry-run)' : ''}\n`)

  // 1. All FAILED items
  const failed = await scanAll({
    TableName: TABLE,
    FilterExpression: '#s = :failed',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':failed': { S: 'FAILED' } },
  })

  // 2. PENDING items that still carry a failReason (stuck from old publisher retry)
  const stalePending = await scanAll({
    TableName: TABLE,
    FilterExpression: 'attribute_exists(failReason) AND #s = :p',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':p': { S: 'PENDING' } },
  })

  // Deduplicate by id
  const seen = new Set()
  const all = [...failed, ...stalePending].filter(i => {
    if (!i.id?.S || seen.has(i.id.S)) return false
    seen.add(i.id.S)
    return true
  })

  if (all.length === 0) {
    console.log('✅ No FAILED or stale PENDING topics found — nothing to reset.')
    return
  }

  console.log(`Found ${all.length} item(s) to reset:\n`)
  all.forEach((item) => {
    const reason = item.failReason?.S?.slice(0, 100) ?? '—'
    console.log(`  • [${item.status?.S}] [${item.category?.S ?? '?'}] ${item.keyword?.S}`)
    console.log(`    Reason: ${reason}\n`)
  })

  if (DRY_RUN) {
    console.log('Dry-run — no changes made. Re-run without --dry-run to reset.')
    return
  }

  let reset = 0
  for (const item of all) {
    await dynamo.send(new UpdateItemCommand({
      TableName: TABLE,
      Key: { id: { S: item.id.S } },
      UpdateExpression: 'SET #s = :pending REMOVE failReason, processedAt, processingAt, currentStep',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':pending': { S: 'PENDING' } },
    }))
    console.log(`  ✓ Reset: ${item.keyword?.S}`)
    reset++
  }

  console.log(`\n✅ Done — ${reset} topic(s) reset to PENDING.`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
