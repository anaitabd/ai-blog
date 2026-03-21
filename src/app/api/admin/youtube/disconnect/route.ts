import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, DeleteParameterCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

async function deleteParam(name: string): Promise<void> {
  try {
    await ssm.send(new DeleteParameterCommand({ Name: name }))
  } catch {
    // Ignore ParameterNotFound — treat as already deleted
  }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  await Promise.all([
    deleteParam('/wealthbeginners/youtube/refresh-token'),
    deleteParam('/wealthbeginners/youtube/channel-id'),
    deleteParam('/wealthbeginners/youtube/channel-name'),
  ])

  return NextResponse.json({ success: true })
}
