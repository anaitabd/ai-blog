export type PostStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'REJECTED'
export type QueueStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'

export interface PostSummary {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: string | null
  readingTime: number
  wordCount: number
  publishedAt: Date | null
  status: PostStatus
  Category: { name: string; slug: string }
  Tag: { name: string }[]
}
