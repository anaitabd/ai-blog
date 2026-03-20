import { vi } from 'vitest'

// ── Prisma mock ────────────────────────────────────────────────────────────
// Every test file that imports @/lib/prisma will get this mock automatically
// when they call `vi.mock('@/lib/prisma')`.
export const prismaMock = {
  post: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue({}),
  },
  category: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  subscriber: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'sub_1', email: 'test@example.com' }),
    count: vi.fn().mockResolvedValue(42),
  },
  youtubeShort: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))
