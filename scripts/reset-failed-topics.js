#!/usr/bin/env node
// Reset all FAILED topics in DynamoDB back to PENDING so the pipeline retries them.
// Usage:  node scripts/reset-failed-topics.js
//         node scripts/reset-failed-topics.js --dry-run

const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb')
require('dotenv').config()

const DRY_RUN = process.argv.includes('--dry-run')
const REGION  = process.env.AWS_REGION ?? process.env.REGION ?? 'us-east-1'
const TABLE   = process.env.TOPICS_TABLE ?? 'ai-blog-topics'

const dynamo = new DynamoDBClient({ region: REGION })

async function main() {
  console.log(`\n🔍 Scanning ${TABLE} for FAILED topics…${DRY_RUN ? ' (dry-run)' : ''}\n`)

  const res = await dynamo.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: '#s = :failed',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':failed': { S: 'FAILED' } },
  }))

  const items = res.Items ?? []

  if (items.length === 0) {
    console.log('✅ No FAILED topics found — nothing to reset.')
    return
  }

  console.log(`Found ${items.length} FAILED topic(s):\n`)
  items.forEach((item) => {
    const reason = item.failReason?.S?.slice(0, 100) ?? '—'
    console.log(`  • [${item.category?.S ?? '?'}] ${item.keyword?.S}`)
    console.log(`    Reason: ${reason}\n`)
  })

  if (DRY_RUN) {
    console.log('Dry-run — no changes made. Re-run without --dry-run to reset.')
    return
  }

  let reset = 0
  for (const item of items) {
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

  console.log(`\n✅ Done — ${reset} topic(s) reset to PENDING. Trigger the pipeline to process them.`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})

