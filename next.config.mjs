/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
  env: {
    DATABASE_URL:          process.env.DATABASE_URL,
    ADMIN_API_KEY:         process.env.ADMIN_API_KEY,
    CLOUDFRONT_DOMAIN:     process.env.CLOUDFRONT_DOMAIN,
    NEXTJS_SITE_URL:       process.env.NEXTJS_SITE_URL,
    WEBHOOK_SECRET:        process.env.WEBHOOK_SECRET,
    REGION:                process.env.REGION,
    S3_BUCKET:             process.env.S3_BUCKET,
    STATE_MACHINE_ARN:     process.env.STATE_MACHINE_ARN,
    TOPICS_TABLE:          process.env.TOPICS_TABLE,
    PINTEREST_ACCESS_TOKEN:process.env.PINTEREST_ACCESS_TOKEN,
    // AWS credentials passed via non-AWS_ prefix (Amplify blocks AWS_ at runtime)
    APP_KEY_ID:            process.env.APP_KEY_ID,
    APP_KEY_SECRET:        process.env.APP_KEY_SECRET,
    // New: internal Lambda→API secret + SES sender
    INTERNAL_SECRET:       process.env.INTERNAL_SECRET,
    SES_FROM_EMAIL:        process.env.SES_FROM_EMAIL,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
