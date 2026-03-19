import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb'

const REGION = process.env.REGION ?? 'us-east-1'
const _creds = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined
const dynamo = new DynamoDBClient({ region: REGION, ...(_creds && { credentials: _creds }) })
const TABLE  = process.env.TOPICS_TABLE ?? 'ai-blog-topics'

export type PipelineItem = {
  id:           string
  keyword:      string
  category:     string
  status:       string
  source:       string | null
  failReason:   string | null
  currentStep:  string | null
  stepUpdatedAt: string | null
  processedAt:  string | null
  processingAt: string | null
  createdAt:    string | null
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // ── 1. Query currently PROCESSING items ───────────────────────────────
    const processingRes = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'status-priority-index',
      KeyConditionExpression: '#s = :status',
      ExpressionAttributeNames:  { '#s': 'status' },
      ExpressionAttributeValues: { ':status': { S: 'PROCESSING' } },
      Limit: 20,
    }))

    // ── 2. Scan for DONE / FAILED items in last 24h ───────────────────────
    const recentRes = await dynamo.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        '(#s = :done OR #s = :failed) AND processedAt >= :since',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':done':   { S: 'DONE' },
        ':failed': { S: 'FAILED' },
        ':since':  { S: since24h },
      },
      Limit: 100,
    }))

    const allItems = [
      ...(processingRes.Items ?? []),
      ...(recentRes.Items   ?? []),
    ]

    // Deduplicate by id (PROCESSING item might also appear in scan)
    const seen = new Set<string>()
    const items: PipelineItem[] = []
    for (const item of allItems) {
      const id = item.id?.S
      if (!id || seen.has(id)) continue
      seen.add(id)
      items.push({
        id,
        keyword:       item.keyword?.S      ?? '',
        category:      item.category?.S     ?? '',
        status:        item.status?.S       ?? 'UNKNOWN',
        source:        item.source?.S       ?? null,
        failReason:    item.failReason?.S   ?? null,
        currentStep:   item.currentStep?.S  ?? null,
        stepUpdatedAt: item.stepUpdatedAt?.S ?? null,
        processedAt:   item.processedAt?.S  ?? null,
        processingAt:  item.processingAt?.S ?? null,
        createdAt:     item.createdAt?.S    ?? null,
      })
    }

    // Sort: PROCESSING first, then by most-recent processedAt / processingAt
    items.sort((a, b) => {
      if (a.status === 'PROCESSING' && b.status !== 'PROCESSING') return -1
      if (b.status === 'PROCESSING' && a.status !== 'PROCESSING') return  1
      const ta = a.processedAt ?? a.processingAt ?? a.createdAt ?? ''
      const tb = b.processedAt ?? b.processingAt ?? b.createdAt ?? ''
      return tb.localeCompare(ta)
    })

    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pipeline] DynamoDB error:', msg)
    return NextResponse.json({ error: 'Failed to load pipeline', detail: msg }, { status: 500 })
  }
}
