import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })

export const dynamic = 'force-dynamic'

export interface PipelineItem {
  id: string
  keyword: string
  status: string
  currentStep: string | null
  processingAt: string | null
  processedAt: string | null
  failReason: string | null
  source: string | null
  trendScore: number | null
}

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Scan for all PROCESSING items + DONE/FAILED from the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const result = await dynamo.send(
      new ScanCommand({
        TableName: process.env.TOPICS_TABLE!,
        FilterExpression:
          '#s = :processing OR (#s IN (:done, :failed) AND processedAt >= :cutoff)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':processing': { S: 'PROCESSING' },
          ':done':       { S: 'DONE' },
          ':failed':     { S: 'FAILED' },
          ':cutoff':     { S: cutoff },
        },
      }),
    )

    const items: PipelineItem[] = (result.Items ?? []).map((item) => ({
      id:           item.id?.S ?? '',
      keyword:      item.keyword?.S ?? '',
      status:       item.status?.S ?? '',
      currentStep:  item.currentStep?.S ?? null,
      processingAt: item.processingAt?.S ?? null,
      processedAt:  item.processedAt?.S ?? null,
      failReason:   item.failReason?.S ?? null,
      source:       item.source?.S ?? null,
      trendScore:   item.trendScore?.N ? Number(item.trendScore.N) : null,
    }))

    // Sort: PROCESSING first, then by processedAt/processingAt desc
    items.sort((a, b) => {
      if (a.status === 'PROCESSING' && b.status !== 'PROCESSING') return -1
      if (b.status === 'PROCESSING' && a.status !== 'PROCESSING') return 1
      const tA = a.processedAt ?? a.processingAt ?? ''
      const tB = b.processedAt ?? b.processingAt ?? ''
      return tB.localeCompare(tA)
    })

    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Pipeline API error:', err)
    return NextResponse.json({ error: 'Failed to fetch pipeline data' }, { status: 500 })
  }
}
