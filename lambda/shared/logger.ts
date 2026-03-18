import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

export interface LogEntry {
  ts: string
  lambda: string
  executionId?: string
  step: string
  status: 'start' | 'complete' | 'warn' | 'error' | 'skip'
  pct?: number
  meta?: Record<string, unknown>
}

/**
 * Emits a structured JSON log line that CloudWatch can index and filter.
 */
export function log(entry: Omit<LogEntry, 'ts'>) {
  const line: LogEntry = { ts: new Date().toISOString(), ...entry }
  console.log(JSON.stringify(line))
}

/**
 * Writes the current pipeline step to the DynamoDB topic item so the
 * /api/admin/pipeline endpoint can surface it in the admin dashboard.
 */
export async function updateTopicStep(
  topicId: string | undefined,
  currentStep: string,
  dynamo: DynamoDBClient,
  table: string,
) {
  if (!topicId) return
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { id: { S: topicId } },
        UpdateExpression: 'SET currentStep = :s, stepUpdatedAt = :now',
        ExpressionAttributeValues: {
          ':s': { S: currentStep },
          ':now': { S: new Date().toISOString() },
        },
      }),
    )
  } catch {
    // Non-blocking — logging failures must not break the pipeline
  }
}
