// ─────────────────────────────────────────────────────────────────────────────
//  Pinterest API helpers for Lambda functions
//  Extracted from src/lib/pinterest.ts so Lambdas don't cross-import Next.js code
// ─────────────────────────────────────────────────────────────────────────────

const PINTEREST_API = 'https://api.pinterest.com/v5'

export interface PinData {
  title: string
  description: string
  link: string
  imageUrl: string
  boardId: string
  altText: string
}

export interface PinResult {
  id: string
  url: string
}

// Map article categories to Pinterest board IDs
export function getBoardIdForCategory(category: string): string {
  const categoryLower = category.toLowerCase()

  if (['investing', 'retirement', 'stocks', 'etf', 'index funds', 'roth ira', '401k'].some(c => categoryLower.includes(c))) {
    return process.env.PINTEREST_BOARD_INVESTING!
  }
  if (['budget', 'saving', 'frugal', 'money saving', 'expense', 'spending'].some(c => categoryLower.includes(c))) {
    return process.env.PINTEREST_BOARD_BUDGETING!
  }
  if (['debt', 'credit', 'loan', 'credit card', 'credit score'].some(c => categoryLower.includes(c))) {
    return process.env.PINTEREST_BOARD_DEBT!
  }
  if (['income', 'side hustle', 'passive', 'freelance', 'earn money'].some(c => categoryLower.includes(c))) {
    return process.env.PINTEREST_BOARD_INCOME!
  }

  return process.env.PINTEREST_BOARD_GENERAL!
}

// Create a Pinterest pin
export async function createPin(data: PinData): Promise<PinResult> {
  const response = await fetch(`${PINTEREST_API}/pins`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: data.title.slice(0, 100), // Pinterest max 100 chars
      description: data.description.slice(0, 500), // Pinterest max 500 chars
      link: data.link,
      board_id: data.boardId,
      media_source: {
        source_type: 'image_url',
        url: data.imageUrl,
      },
      alt_text: data.altText.slice(0, 500),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pinterest API error: ${response.status} — ${error}`)
  }

  const result = await response.json() as { id: string }
  return {
    id: result.id,
    url: `https://pinterest.com/pin/${result.id}`,
  }
}

// Build Pinterest pin description from article
export function buildPinDescription(params: {
  title: string
  excerpt: string
  tags: string[]
  keyword: string
}): string {
  const hashtags = [
    ...params.tags.slice(0, 4).map(t => `#${t.replace(/\s+/g, '')}`),
    '#personalfinance',
    '#moneytips',
    '#wealthbeginners',
    '#financialfreedom',
    '#moneysavingtips',
  ].join(' ')

  return `${params.excerpt}\n\n💰 Read the full guide on WealthBeginners.com\n\n${hashtags}`.slice(0, 500)
}

// Build optimized pin title (different from article title)
export function buildPinTitle(articleTitle: string): string {
  const title = articleTitle
    .replace(/\d{4}$/, '') // remove year
    .replace(/\| WealthBeginners$/, '')
    .trim()

  if (title.length < 40) {
    return `${title} — Simple Tips for Beginners`
  }

  return title.slice(0, 100)
}



