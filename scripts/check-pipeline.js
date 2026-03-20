// node scripts/check-pipeline.js
const { DynamoDBClient, ScanCommand, QueryCommand } = require('@aws-sdk/client-dynamodb')
require('dotenv').config()

const dynamo = new DynamoDBClient({ region: 'us-east-1' })

async function check() {
  const processing = await dynamo.send(new QueryCommand({
    TableName: 'ai-blog-topics',
    IndexName: 'status-priority-index',
    KeyConditionExpression: '#s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': { S: 'PROCESSING' } },
  }))

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await dynamo.send(new ScanCommand({
    TableName: 'ai-blog-topics',
    FilterExpression: '(#s = :done OR #s = :failed) AND processedAt >= :since',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':done':  { S: 'DONE' },
      ':failed':{ S: 'FAILED' },
      ':since': { S: since },
    },
  }))

  const all = [...(processing.Items ?? []), ...(recent.Items ?? [])]
  if (all.length === 0) { console.log('No active or recent pipeline runs in the last 2h.'); return }

  // Deduplicate
  const seen = new Set()
  const unique = all.filter(i => { const id = i.id?.S; if (!id || seen.has(id)) return false; seen.add(id); return true })

  unique.sort((a, b) => {
    if (a.status?.S === 'PROCESSING') return -1
    if (b.status?.S === 'PROCESSING') return 1
    return (b.processedAt?.S ?? b.processingAt?.S ?? '').localeCompare(a.processedAt?.S ?? a.processingAt?.S ?? '')
  })

  for (const i of unique) {
    const startedMs = i.processingAt?.S ? Date.now() - new Date(i.processingAt.S).getTime() : null
    const ago = startedMs !== null ? (startedMs < 60000 ? Math.round(startedMs/1000)+'s ago' : Math.round(startedMs/60000)+'m ago') : '—'
    const dur = (i.processingAt?.S && i.processedAt?.S)
      ? Math.round((new Date(i.processedAt.S) - new Date(i.processingAt.S)) / 1000) + 's'
      : null
    console.log(`[${i.status?.S}] ${i.keyword?.S}  (${i.category?.S ?? '?'})`)
    console.log(`  Step    : ${i.currentStep?.S ?? '—'}`)
    console.log(`  Started : ${ago}${dur ? '  |  Duration: ' + dur : ''}`)
    if (i.failReason?.S) console.log(`  Error   : ${i.failReason.S.slice(0, 150)}`)
    console.log('')
  }
}

check().catch(console.error)


