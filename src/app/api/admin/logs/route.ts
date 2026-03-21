import { NextRequest, NextResponse } from 'next/server'
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs'

const REGION = process.env.REGION ?? 'us-east-1'
const _creds = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined
const cwl = new CloudWatchLogsClient({ region: REGION, ...(_creds && { credentials: _creds }) })

const ALL_GROUPS = [
  '/aws/lambda/ai-blog-content-generator',
  '/aws/lambda/ai-blog-youtube-shorts-generator',
  '/aws/lambda/ai-blog-youtube-shorts-publisher',
]

function groupsForType(type: string): { groups: string[]; filterPattern?: string } {
  switch (type) {
    case 'pipeline': return { groups: [ALL_GROUPS[0], ALL_GROUPS[1]] }
    case 'youtube':  return { groups: [ALL_GROUPS[2]] }
    case 'quality':  return { groups: [ALL_GROUPS[0]] }
    case 'errors':   return { groups: ALL_GROUPS, filterPattern: '?ERROR ?FAILED ?Exception' }
    default:         return { groups: ALL_GROUPS }
  }
}

function sourceName(logGroup: string): string {
  return logGroup.split('/').pop() ?? logGroup
}

interface ParsedLog {
  timestamp: string
  source: string
  level: string | null
  event: string | null
  data: Record<string, unknown>
  raw: string | null
}

function parseEvent(message: string, source: string): ParsedLog {
  let parsed: Record<string, unknown> = {}
  let raw: string | null = null

  try {
    parsed = JSON.parse(message) as Record<string, unknown>
  } catch {
    raw = message.trim()
  }

  const level =
    typeof parsed.level === 'string' ? parsed.level :
    typeof parsed.status === 'string' && /error|fail/i.test(parsed.status) ? 'ERROR' :
    null

  const event = typeof parsed.event === 'string' ? parsed.event :
                typeof parsed.step  === 'string' ? parsed.step  :
                null

  return { timestamp: '', source, level, event, data: parsed, raw }
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const type  = searchParams.get('type')  ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const hours = parseInt(searchParams.get('hours') ?? '6', 10)

  const startTime = Date.now() - hours * 3600 * 1000
  const { groups, filterPattern } = groupsForType(type)

  try {
    const fetches = groups.map(async (group) => {
      try {
        const cmd = new FilterLogEventsCommand({
          logGroupName: group,
          startTime,
          limit,
          ...(filterPattern ? { filterPattern } : {}),
        })
        const res = await cwl.send(cmd)
        return (res.events ?? []).map((e) => {
          const parsed = parseEvent(e.message ?? '', sourceName(group))
          parsed.timestamp = e.timestamp
            ? new Date(e.timestamp).toISOString()
            : new Date().toISOString()
          return parsed
        })
      } catch {
        // Log group may not exist yet — skip silently
        return [] as ParsedLog[]
      }
    })

    const results = await Promise.all(fetches)
    const logs = results
      .flat()
      .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
      .slice(0, limit)

    return NextResponse.json({
      logs,
      total: logs.length,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch logs: ${String(err)}` },
      { status: 500 },
    )
  }
}
