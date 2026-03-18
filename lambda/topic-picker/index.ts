import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { log, updateTopicStep } from '../shared/logger'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })
const sfn = new SFNClient({ region: process.env.AWS_REGION })

export const handler = async () => {
  log({ lambda: 'topic-picker', step: 'handler-start', status: 'start', pct: 0 })

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
    log({ lambda: 'topic-picker', step: 'no-topics', status: 'skip', pct: 100 })
    return { status: 'empty' }
  }

  const topic    = result.Items[0]
  const topicId  = topic.id.S!
  const keyword  = topic.keyword.S!
  const category = topic.category.S!

  await dynamo.send(
    new UpdateItemCommand({
      TableName: process.env.TOPICS_TABLE!,
      Key: { id: { S: topicId } },
      UpdateExpression: 'SET #s = :processing, processingAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':processing': { S: 'PROCESSING' },
        ':now':        { S: new Date().toISOString() },
      },
    })
  )

  await updateTopicStep(topicId, 'Pipeline starting…', dynamo, process.env.TOPICS_TABLE!)

  const executionName = `article-${topicId}-${Date.now()}`
  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN!,
      name: executionName,
      input: JSON.stringify({ topicId, keyword, category }),
    })
  )

  log({ lambda: 'topic-picker', step: 'pipeline-started', status: 'complete', pct: 100,
    meta: { topicId, keyword, category, executionName } })

  return { status: 'started', topicId, keyword }
}
