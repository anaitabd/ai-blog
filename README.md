# AI Blog — Fully Automated Blog with AWS Bedrock + Next.js

A production-ready, fully automated blogging platform that generates SEO-optimized articles using AWS Bedrock (Claude), passes Google AdSense criteria, and runs on a daily schedule.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, SSG + ISR) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma (AWS RDS) |
| AI Engine | AWS Bedrock (Claude Sonnet) |
| Image Gen | AWS Bedrock (Titan Image Generator) |
| Pipeline | AWS Lambda + Step Functions |
| Scheduler | Amazon EventBridge |
| Queue | Amazon DynamoDB |
| CDN | Amazon CloudFront + S3 |
| Infra | AWS CDK |
| Deploy | Vercel (recommended) |

---

## Project Structure

```
ai-blog/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (blog)/           # Public blog pages
│   │   ├── admin/            # Admin dashboard
│   │   └── api/              # API routes (webhook, admin)
│   ├── components/           # Reusable components
│   ├── lib/                  # Prisma, Bedrock, utilities
│   └── types/                # TypeScript types
├── prisma/
│   └── schema.prisma         # Database schema
├── lambda/                   # AWS Lambda functions
│   ├── topic-seeder/         # Seeds DynamoDB with keywords
│   ├── topic-picker/         # Picks next topic, starts pipeline
│   ├── content-generator/    # Calls Bedrock to write article
│   └── publisher/            # Generates image, posts to webhook
└── infra/                    # AWS CDK infrastructure
    └── stack.ts              # All AWS resources defined as code
```

---

## Setup Guide

### 1. Clone and install

```bash
git clone https://github.com/yourusername/ai-blog.git
cd ai-blog
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Set up AWS RDS (PostgreSQL)

1. Go to AWS Console → RDS → Create database
2. Engine: PostgreSQL 15, Instance: db.t3.micro (free tier)
3. Enable public access (or use VPC for production)
4. Copy connection string to `DATABASE_URL` in `.env.local`

### 4. Run database migrations

```bash
npm run db:generate
npm run db:migrate
```

### 5. Deploy AWS infrastructure

```bash
cd infra
npm install
npm install -g aws-cdk

# Configure AWS CLI first
aws configure

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy everything
NEXTJS_SITE_URL=https://yourdomain.com \
WEBHOOK_SECRET=your-random-secret \
npx cdk deploy
```

Copy the `ImagesCdnUrl` output → add as `CLOUDFRONT_DOMAIN` in `.env.local`

### 6. Seed topic queue

```bash
aws lambda invoke \
  --function-name ai-blog-topic-seeder \
  --payload '{}' \
  /dev/stdout
```

### 7. Deploy Next.js to Vercel

```bash
npm install -g vercel
vercel
```

Add all `.env.local` values as Vercel environment variables.

### 8. Test the pipeline

```bash
# Trigger manually
aws lambda invoke \
  --function-name ai-blog-topic-picker \
  --payload '{}' \
  /dev/stdout

# Watch Step Functions execution in AWS Console
```

### 9. Access admin dashboard

Visit `https://yourdomain.com/admin`

Use your `ADMIN_API_KEY` to approve/reject posts.

---

## AdSense Checklist

Before applying to Google AdSense:

- [ ] Custom domain with HTTPS
- [ ] 25+ published quality articles (1500+ words each)
- [ ] All required pages live: `/about`, `/contact`, `/privacy-policy`, `/disclaimer`
- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] Robots.txt at `/robots.txt`
- [ ] Google Search Console verified
- [ ] Google Analytics (GA4) installed
- [ ] Site indexed — check with `site:yourdomain.com` in Google
- [ ] Lighthouse score 90+ on Performance, SEO, Accessibility
- [ ] Wait 2–4 weeks after first article before applying

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_BEDROCK_MODEL_ID` | Bedrock model (default: `anthropic.claude-sonnet-4-5`) |
| `AWS_S3_BUCKET` | S3 bucket name for images |
| `NEXT_PUBLIC_SITE_URL` | Your live site URL |
| `NEXT_PUBLIC_SITE_NAME` | Blog name shown in header |
| `NEXT_PUBLIC_ADSENSE_ID` | Google AdSense publisher ID |
| `WEBHOOK_SECRET` | Secret shared between Lambda and Next.js |
| `ADMIN_API_KEY` | Key to access admin dashboard APIs |
| `CLOUDFRONT_DOMAIN` | CloudFront domain for images (from CDK output) |
| `STATE_MACHINE_ARN` | Step Functions ARN (from CDK output) |
| `TOPICS_TABLE` | DynamoDB table name (default: `ai-blog-topics`) |

---

## Pipeline Flow

```
EventBridge (3x/day: 7am, 1pm, 7pm UTC)
         ↓
   topic-picker Lambda
         ↓
   Step Functions
      ├─ content-generator Lambda (calls Bedrock Claude)
      │       ↓ quality gate fails? → retry up to 2x
      └─ publisher Lambda
              ├─ generate image (Bedrock Titan)
              ├─ upload to S3 → serve via CloudFront
              └─ POST to /api/publish
                       ↓
              Next.js saves to PostgreSQL
              Status = REVIEW
                       ↓
              Admin reviews at /admin
                       ↓
              Approve → PUBLISHED → live on site
```

---

## Monthly Cost Estimate

| Service | Cost |
|---|---|
| AWS RDS (db.t3.micro) | ~$15 |
| AWS Bedrock (100 articles/month) | ~$15–25 |
| AWS Lambda + Step Functions | ~$1–2 |
| S3 + CloudFront | ~$3–5 |
| Vercel (hobby) | Free |
| **Total** | **~$35–50/month** |

---

## Customization

**Change your niche:** Edit `lambda/topic-seeder/index.ts` — update the `TOPICS` array with keywords relevant to your niche.

**Change publish frequency:** Edit `infra/stack.ts` — find the `EventBridge` rule and update the cron schedule.

**Auto-publish without review:** In `src/app/api/publish/route.ts`, change `status: 'REVIEW'` to `status: 'PUBLISHED'`.

**Add GA4:** Add your GA4 script to `src/app/layout.tsx`.

---

## License

MIT
