// ─────────────────────────────────────────────────────────────────────────────
//  Auto-pins articles to Pinterest when they are published
//  Called by the Step Functions pipeline after article is live
// ─────────────────────────────────────────────────────────────────────────────

import { getBoardIdForCategory, createPin, buildPinDescription, buildPinTitle } from '../../src/lib/pinterest'

interface PinterestPublishEvent {
  postId: string
  slug: string
  title: string
  excerpt: string
  keyword: string
  category: string
  tags: string[]
  pinterestImageUrl: string
}

export const handler = async (event: PinterestPublishEvent) => {
  const { postId, slug, title, excerpt, keyword, category, tags, pinterestImageUrl } = event

  console.log(`Pinning to Pinterest: "${title}"`)

  try {
    const boardId = getBoardIdForCategory(category)
    const pinTitle = buildPinTitle(title)
    const pinDescription = buildPinDescription({ title, excerpt, tags, keyword })
    const articleUrl = `https://wealthbeginners.com/${slug}?utm_source=pinterest&utm_medium=social&utm_campaign=autopublish`

    const pin = await createPin({
      title: pinTitle,
      description: pinDescription,
      link: articleUrl,
      imageUrl: pinterestImageUrl,
      boardId,
      altText: `${title} — WealthBeginners personal finance guide`,
    })

    console.log(`Pinned successfully: ${pin.url}`)

    // Update the post in the database with pin info
    // This calls the Next.js API to update the record
    await fetch(`${process.env.NEXTJS_SITE_URL}/api/admin/posts/${postId}/pinterest`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET!,
      },
      body: JSON.stringify({
        pinterestPinId: pin.id,
        pinterestPinUrl: pin.url,
        pinterestImage: pinterestImageUrl,
        pinterestPinnedAt: new Date().toISOString(),
      }),
    })

    return { success: true, pinId: pin.id, pinUrl: pin.url }
  } catch (err) {
    // Pinterest failure is non-blocking — article is already published
    console.error('Pinterest publish failed (non-blocking):', err)
    return { success: false, error: String(err) }
  }
}
