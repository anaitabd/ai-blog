import { NextRequest, NextResponse } from 'next/server'
import {
  SFNClient,
  ListExecutionsCommand,
  GetExecutionHistoryCommand,
} from '@aws-sdk/client-sfn'

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
}

const sfn = new SFNClient({ region: process.env.AWS_REGION, credentials })

export const dynamic = 'force-dynamic'

export interface LogEvent {
  timestamp: string
  type: string
  step?: string
  detail?: string
  error?: string
  cause?: string
}

export interface ExecutionLog {
  executionArn: string
  name: string
  status: string
  startDate: string
  stopDate?: string
  events: LogEvent[]
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topicId = params.id

  try {
    // List recent executions and find ones matching this topic ID
    const listResult = await sfn.send(
      new ListExecutionsCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        maxResults: 20,
      }),
    )

    const matchingExecutions = (listResult.executions ?? []).filter(
      (e) => e.name?.includes(topicId),
    )

    if (matchingExecutions.length === 0) {
      return NextResponse.json({ executions: [], message: 'No executions found for this topic' })
    }

    // Get detailed history for the most recent matching execution
    const execution = matchingExecutions[0]
    const historyResult = await sfn.send(
      new GetExecutionHistoryCommand({
        executionArn: execution.executionArn!,
        maxResults: 100,
        reverseOrder: false,
      }),
    )

    const events: LogEvent[] = (historyResult.events ?? []).map((e) => {
      const event: LogEvent = {
        timestamp: e.timestamp?.toISOString() ?? '',
        type: e.type ?? '',
      }

      // Extract step name from state events
      if (e.stateEnteredEventDetails) {
        event.step = e.stateEnteredEventDetails.name
        // Try to parse input for context
        try {
          const input = JSON.parse(e.stateEnteredEventDetails.input ?? '{}')
          if (input.keyword) event.detail = `Keyword: ${input.keyword}`
          if (input.article?.title) event.detail = `Article: ${input.article.title}`
        } catch { /* ignore */ }
      }

      if (e.stateExitedEventDetails) {
        event.step = e.stateExitedEventDetails.name
      }

      // Extract error info
      if (e.taskFailedEventDetails) {
        event.error = e.taskFailedEventDetails.error ?? undefined
        // Parse cause and extract just the error message, not the full HTML
        try {
          const cause = JSON.parse(e.taskFailedEventDetails.cause ?? '{}')
          const msg = cause.errorMessage ?? ''
          // Truncate HTML from error messages
          if (msg.includes('<!DOCTYPE')) {
            const match = msg.match(/Webhook failed: (\d+)/)
            event.cause = match
              ? `Webhook failed with status ${match[1]} — ngrok endpoint offline (ERR_NGROK_3200)`
              : 'Webhook failed — ngrok endpoint offline'
          } else {
            event.cause = msg.substring(0, 500)
          }
        } catch {
          event.cause = (e.taskFailedEventDetails.cause ?? '').substring(0, 500)
        }
      }

      if (e.lambdaFunctionFailedEventDetails) {
        event.error = e.lambdaFunctionFailedEventDetails.error ?? undefined
        event.cause = (e.lambdaFunctionFailedEventDetails.cause ?? '').substring(0, 500)
      }

      if (e.executionFailedEventDetails) {
        event.error = e.executionFailedEventDetails.error ?? undefined
        event.cause = e.executionFailedEventDetails.cause ?? undefined
      }

      if (e.taskSucceededEventDetails) {
        event.step = 'TaskSucceeded'
        try {
          const output = JSON.parse(e.taskSucceededEventDetails.output ?? '{}')
          if (output.postId) event.detail = `Post published: ${output.postId}`
          if (output.slug) event.detail = `Published: /${output.slug}`
        } catch { /* ignore */ }
      }

      return event
    })

    // Filter to only meaningful events (not internal SFN orchestration noise)
    const meaningfulTypes = new Set([
      'ExecutionStarted',
      'TaskStateEntered',
      'TaskStarted',
      'TaskSucceeded',
      'TaskFailed',
      'TaskStateExited',
      'FailStateEntered',
      'ExecutionFailed',
      'ExecutionSucceeded',
      'ChoiceStateEntered',
      'ChoiceStateExited',
      'WaitStateEntered',
      'WaitStateExited',
    ])

    const filteredEvents = events.filter((e) => meaningfulTypes.has(e.type))

    const executionLog: ExecutionLog = {
      executionArn: execution.executionArn!,
      name: execution.name!,
      status: execution.status!,
      startDate: execution.startDate?.toISOString() ?? '',
      stopDate: execution.stopDate?.toISOString(),
      events: filteredEvents,
    }

    return NextResponse.json({
      executions: [executionLog],
      totalExecutions: matchingExecutions.length,
    })
  } catch (err) {
    console.error('Logs API error:', err)
    return NextResponse.json({ error: 'Failed to fetch execution logs' }, { status: 500 })
  }
}

