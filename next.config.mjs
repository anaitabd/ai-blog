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
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes:  [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '**.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
    ],
  },
  compress: true,
  poweredByHeader: false,
  env: {
    DATABASE_URL:          process.env.DATABASE_URL,
    ADMIN_API_KEY:         process.env.ADMIN_API_KEY,
    CLOUDFRONT_DOMAIN:     process.env.CLOUDFRONT_DOMAIN,
    NEXTJS_SITE_URL:       process.env.NEXTJS_SITE_URL,
    WEBHOOK_SECRET:        process.env.WEBHOOK_SECRET,
    REGION:                process.env.REGION,
    S3_BUCKET:             process.env.S3_BUCKET             || process.env.AWS_S3_BUCKET,
    AWS_S3_BUCKET:         process.env.AWS_S3_BUCKET         || process.env.S3_BUCKET,
    STATE_MACHINE_ARN:     process.env.STATE_MACHINE_ARN,
    TOPICS_TABLE:          process.env.TOPICS_TABLE,
    PINTEREST_ACCESS_TOKEN: process.env.PINTEREST_ACCESS_TOKEN,
    YOUTUBE_ON_DEMAND_ARN: process.env.YOUTUBE_ON_DEMAND_ARN,
    // AWS credentials — non-AWS_ prefix so Amplify doesn't strip them
    APP_KEY_ID:            process.env.APP_KEY_ID            || process.env.AWS_ACCESS_KEY_ID,
    APP_KEY_SECRET:        process.env.APP_KEY_SECRET        || process.env.AWS_SECRET_ACCESS_KEY,
    // Security
    INTERNAL_SECRET:       process.env.INTERNAL_SECRET,
    SES_FROM_EMAIL:        process.env.SES_FROM_EMAIL,
    // Image & AI APIs
    PEXELS_API_KEY:        process.env.PEXELS_API_KEY,
    UNSPLASH_ACCESS_KEY:   process.env.UNSPLASH_ACCESS_KEY,
    ANTHROPIC_API_KEY:     process.env.ANTHROPIC_API_KEY,
    // Email
    RESEND_API_KEY:        process.env.RESEND_API_KEY,
    // YouTube OAuth2 (values set in Amplify Console env vars)
    YOUTUBE_CLIENT_ID:     process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    NEXT_PUBLIC_GA4_ID:    'G-PDQELT04X9',
    NEXT_PUBLIC_SITE_URL:  'https://www.wealthbeginners.com',
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
