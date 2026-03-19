// Quick API connectivity test — run: node scripts/test-apis.mjs
import { config } from 'dotenv'
config()

async function testPexels() {
  const key = process.env.PEXELS_API_KEY
  if (!key) return console.log('⚠️  PEXELS_API_KEY not set')
  const r = await fetch(
    'https://api.pexels.com/v1/search?query=credit+card+financial&per_page=1&orientation=landscape',
    { headers: { Authorization: key } }
  )
  const d = await r.json()
  const url = d.photos?.[0]?.src?.large2x
  console.log(`Pexels: ${r.status === 200 ? '✅' : '❌'} ${r.status} | url: ${url?.slice(0, 60) ?? 'none'}`)
}

async function testUnsplash() {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return console.log('⚠️  UNSPLASH_ACCESS_KEY not set')
  const r = await fetch(
    'https://api.unsplash.com/search/photos?query=personal+finance&per_page=1',
    { headers: { Authorization: `Client-ID ${key}` } }
  )
  const d = await r.json()
  const url = d.results?.[0]?.urls?.regular
  console.log(`Unsplash: ${r.status === 200 ? '✅' : '❌'} ${r.status} | url: ${url?.slice(0, 60) ?? 'none'}`)
}

console.log('Testing APIs...')
await Promise.all([testPexels(), testUnsplash()])
console.log('Done.')

