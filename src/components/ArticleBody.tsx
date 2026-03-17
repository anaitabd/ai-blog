'use client'

interface Props {
  content: string
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\[INTERNAL_LINK: ([^\]]+)\]/g, '<span class="text-blue-600">$1</span>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .replace(/<\/p><p>/g, '</p>\n<p>')
}

export default function ArticleBody({ content }: Props) {
  const html = markdownToHtml(content)

  return (
    <div
      className="prose prose-gray max-w-none
        prose-headings:font-semibold prose-headings:text-gray-900
        prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-gray-700 prose-p:leading-relaxed
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-gray-900
        prose-code:bg-gray-100 prose-code:text-gray-800 prose-code:rounded prose-code:px-1
        prose-ul:text-gray-700 prose-li:my-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
