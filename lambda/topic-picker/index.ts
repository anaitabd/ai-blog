import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })
const sfn = new SFNClient({ region: process.env.AWS_REGION })

export const handler = async () => {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.TOPICS_TABLE!,
      IndexName: 'status-priority-index',
      KeyConditionExpression: '#s = :status',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':status': { S: 'PENDING' } },
      ScanIndexForward: false,
      Limit: 1,
    })
  )

  if (!result.Items || result.Items.length === 0) {
    console.log('No pending topics in queue')
    return { status: 'empty' }
  }

  const topic = result.Items[0]
  const topicId = topic.id.S!
  const keyword = topic.keyword.S!
  const category = topic.category.S!

  await dynamo.send(
    new UpdateItemCommand({
      TableName: process.env.TOPICS_TABLE!,
      Key: { id: { S: topicId } },
      UpdateExpression: 'SET #s = :processing, processingAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':processing': { S: 'PROCESSING' },
        ':now': { S: new Date().toISOString() },
      },
    })
  )

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN!,
      name: `article-${topicId}-${Date.now()}`,
      input: JSON.stringify({ topicId, keyword, category }),
    })
  )

  console.log(`Started pipeline for: "${keyword}"`)
  return { status: 'started', topicId, keyword }
}
