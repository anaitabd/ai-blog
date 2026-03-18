import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
}

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION, credentials })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topicId = params.id

  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: process.env.TOPICS_TABLE ?? 'ai-blog-topics',
        Key: { id: { S: topicId } },
        UpdateExpression:
          'SET #s = :pending, currentStep = :step REMOVE processingAt, processedAt, failReason, stepUpdatedAt',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':pending': { S: 'PENDING' },
          ':step':    { S: 'Reset for retry' },
        },
      }),
    )

    return NextResponse.json({ success: true, topicId })
  } catch (err) {
    console.error('Retry API error:', err)
    return NextResponse.json({ error: 'Failed to reset topic' }, { status: 500 })
  }
}
