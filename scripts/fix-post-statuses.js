// RUN: node scripts/fix-post-statuses.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fix() {
  // Find duplicate REVIEW posts that already have a PUBLISHED version
  const toDelete = await prisma.post.findMany({
    where: {
      status: 'REVIEW',
      title: {
        in: [
          'How to Improve Your Credit Score 100 Points in 2026',
          'Best Passive Income Ideas That Actually Work in 2026',
        ],
      },
    },
    select: { id: true, title: true },
  })

  const ids = toDelete.map((p) => p.id)
  console.log('Duplicate REVIEW posts to delete:', toDelete.map((p) => p.title))

  // Delete related youtube shorts first (FK constraint)
  await prisma.youtubeShort.deleteMany({ where: { postId: { in: ids } } })

  // Delete the duplicate REVIEW posts
  await prisma.post.deleteMany({ where: { id: { in: ids } } })
  console.log(`Deleted ${ids.length} duplicate posts`)

  // Publish any remaining REVIEW posts
  const updated = await prisma.post.updateMany({
    where: { status: 'REVIEW' },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })
  console.log(`Published ${updated.count} previously stuck REVIEW posts`)

  // Show final state
  const posts = await prisma.post.findMany({
    select: { title: true, status: true, publishedAt: true },
  })
  console.log('\nFinal post state:')
  posts.forEach((p) =>
    console.log(`  [${p.status}] ${p.title} — publishedAt: ${p.publishedAt}`)
  )

  await prisma.$disconnect()
}

fix().catch((e) => {
  console.error(e.message)
  prisma.$disconnect()
  process.exit(1)
})

