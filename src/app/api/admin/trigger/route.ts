import { NextRequest, NextResponse } from 'next/server'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
}

const sfn    = new SFNClient({ region: process.env.AWS_REGION, credentials })
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION, credentials })

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: process.env.TOPICS_TABLE ?? 'ai-blog-topics',
        IndexName: 'status-priority-index',
        KeyConditionExpression: '#s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': { S: 'PENDING' } },
        ScanIndexForward: false,
        Limit: 1,
      })
    )

    if (!result.Items || result.Items.length === 0) {
      return NextResponse.json({ error: 'No pending topics in queue' }, { status: 404 })
    }

    const topic           = result.Items[0]
    const topicId         = topic.id.S!
    const keyword         = topic.keyword.S!
    const category        = topic.category.S!
    const relatedArticle  = topic.relatedArticle?.S
    const leadMagnet      = topic.leadMagnet?.S

    const executionName = `manual-${topicId}-${Date.now()}`

    // ── Mark topic as PROCESSING in DynamoDB first ────────────────────────
    await dynamo.send(
      new UpdateItemCommand({
        TableName: process.env.TOPICS_TABLE ?? 'ai-blog-topics',
        Key: { id: { S: topicId } },
        UpdateExpression: 'SET #s = :processing, processingAt = :now, currentStep = :step',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':processing': { S: 'PROCESSING' },
          ':now':        { S: new Date().toISOString() },
          ':step':       { S: 'Pipeline starting…' },
        },
      })
    )

    // ── Start Step Function execution ─────────────────────────────────────
    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        name: executionName,
        input: JSON.stringify({
          topicId,
          keyword,
          category,
          relatedArticle,
          leadMagnet,
        }),
      })
    )

    return NextResponse.json({ success: true, keyword })
  } catch (err) {
    console.error('Trigger error:', err)
    return NextResponse.json({ error: 'Failed to trigger pipeline' }, { status: 500 })
  }
}

