// RUN IMMEDIATELY: npx ts-node -r dotenv/config scripts/clean-post-content.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Inlined to avoid module resolution issues with ts-node
function sanitizePostContent(content: string): string {
  return content
    .replace(/\[INSERT[^\]]*\]/gi, '')
    .replace(/\[TODO[^\]]*\]/gi, '')
    .replace(/\[PLACEHOLDER[^\]]*\]/gi, '')
    .replace(/\[ADD[^\]]*\]/gi, '')
    .replace(/\[ANECDOTE[^\]]*\]/gi, '')
    .replace(/\[INCLUDE[^\]]*\]/gi, '')
    .replace(/\[FILL[^\]]*\]/gi, '')
    .replace(/\[REPLACE[^\]]*\]/gi, '')
    .replace(/\[EXAMPLE[^\]]*\]/gi, '')
    .replace(/\[YOUR[^\]]*\]/gi, '')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>\s*&nbsp;\s*<\/p>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function cleanAllPosts() {
  const posts = await prisma.post.findMany()
  let cleaned = 0

  for (const post of posts) {
    const cleanContent = sanitizePostContent(post.content)
    const cleanExcerpt  = post.excerpt
      .replace(/\[INSERT[^\]]*\]/gi, '')
      .replace(/\[TODO[^\]]*\]/gi, '')
      .replace(/\[PLACEHOLDER[^\]]*\]/gi, '')
      .trim()

    if (cleanContent !== post.content || cleanExcerpt !== post.excerpt) {
      await prisma.post.update({
        where: { id: post.id },
        data: { content: cleanContent, excerpt: cleanExcerpt },
      })
      console.log(`✓ Cleaned: ${post.title}`)
      cleaned++
    }
  }

  console.log(`\nDone. ${cleaned}/${posts.length} posts cleaned.`)
  await prisma.$disconnect()
}

cleanAllPosts().catch((err) => {
  console.error(err)
  process.exit(1)
})


