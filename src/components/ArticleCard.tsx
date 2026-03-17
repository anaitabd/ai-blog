import Link from 'next/link'

interface Props {
  post: {
    slug: string
    title: string
    excerpt: string
    featuredImage: string | null
    readingTime: number
    publishedAt: Date | null
    category: { name: string; slug: string }
  }
}

export default function ArticleCard({ post }: Props) {
  return (
    <Link href={`/${post.slug}`} className="group block h-full">
      <article className="border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col bg-white">
        {post.featuredImage ? (
          <div className="relative h-44 bg-gray-100 overflow-hidden">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="h-44 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <span className="text-4xl opacity-30">📝</span>
          </div>
        )}
        <div className="p-4 flex flex-col flex-1">
          <Link
            href={`/category/${post.category.slug}`}
            className="text-xs text-blue-600 font-medium mb-1 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {post.category.name}
          </Link>
          <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 flex-1 mb-2">
            {post.title}
          </h2>
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {post.excerpt}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto">
            <span>{post.readingTime} min read</span>
            {post.publishedAt && (
              <time dateTime={post.publishedAt.toISOString()}>
                {post.publishedAt.toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </time>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
