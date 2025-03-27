import Redis from 'ioredis'
import { joinURL } from 'ufo'
import type { ModuleRuntimeConfig, NitroUrlResolvers, SitemapIndexEntry, SitemapUrl } from '../types'

const DEFAULT_REDIS_OPTIONS = {
  host: '127.0.0.1',
  port: 6379,
}

const createRedisClient = (redisConfig?: Record<string, any>): Redis => {
  return new Redis({ ...DEFAULT_REDIS_OPTIONS, ...redisConfig })
}

export async function fetchFromRedisByKeyNameAndPart(
  config: ModuleRuntimeConfig,
  redisKey = 'sitemap-url',
  part: number,
): Promise<SitemapUrl[]> {
  if (!config.redis || Object.keys(config.redis).length === 0 || Number.isNaN(part) || part < 1) {
    return []
  }

  let redis: Redis | undefined
  try {
    redis = createRedisClient(config.redis.config)
    const totalUrls = await redis.llen(redisKey)
    const pageSize = 5000
    const sitemapCount = Math.ceil(totalUrls / pageSize)

    if (part < 1 || part > sitemapCount) {
      return []
    }

    const i = part - 1
    const start = i * pageSize
    const end = start + pageSize - 1

    let routes = await redis.lrange(redisKey, start, end)
    routes = routes.map((item) => {
      const route = JSON.parse(item)
      route.loc = route.url
      delete route.url
      return route
    })

    return routes as unknown as SitemapUrl[]
  }
  catch (error) {
    console.error('Error connecting to Redis:', error)
    return []
  }
  finally {
    if (redis) {
      redis.disconnect()
    }
  }
}

async function prepareSitemapFromRedis(config: ModuleRuntimeConfig, preRegistrationForFutureRoutes = false): Promise<SitemapIndexEntry[]> {
  if (config.redis === undefined || config.redis === null || Object.keys(config.redis).length === 0) {
    return []
  }

  const defaultKeyName = { 'sitemap-url': 'sitemap' }
  let keyNameAsArray = Object.entries(defaultKeyName)

  if (config.redis.keyName !== undefined && config.redis.keyName?.constructor === Object) {
    keyNameAsArray = Object.entries(config.redis.keyName)
  }

  let redis: Redis | undefined
  try {
    redis = createRedisClient(config.redis.config)

    let sitemaps: SitemapIndexEntry[] = []

    for (const item of keyNameAsArray) {
      const itemSitemap = await generateSitemapEntriesForNamespace(redis, item, preRegistrationForFutureRoutes)
      sitemaps = sitemaps.concat(itemSitemap)
    }

    return sitemaps as unknown as SitemapIndexEntry[]
  }
  catch (error) {
    console.error('Error connecting to Redis:', error)
    return []
  }
  finally {
    if (redis) {
      redis.disconnect()
    }
  }
}

async function generateSitemapEntriesForNamespace(redis: Redis, [partNamespace, redisKey]: string[], preRegistrationForFutureRoutes = false): Promise<SitemapIndexEntry[]> {
  const totalUrls = await redis.llen(redisKey)
  const pageSize = 5000
  const sitemapCount = Math.ceil(totalUrls / pageSize)

  let lastmod = new Date().toISOString()

  const sitemaps = []
  let lastPart = null
  for (let i = 0; i < sitemapCount; i++) {
    const start = i * pageSize
    const end = start + pageSize - 1

    let routes = await redis.lrange(redisKey, start, end)

    routes = routes.map((item) => {
      return {
        ...JSON.parse(item),
      }
    })

    if (routes.length > 0) {
      if (routes.length === 1) {
        const [route] = sitemaps
        lastmod = route.lastmod
      }
      else {
        // @ts-expect-error 123
        lastmod = routes[routes.length - 1].lastmod
      }
    }

    const partPath = `/${partNamespace}-part${i + 1}.xml`

    lastPart = i + 1

    sitemaps.push({
      _sitemapName: partPath,
      lastmod,
    })

    if (preRegistrationForFutureRoutes && lastPart !== null) {
      for (let i = 1; i <= 2; i++) {
        const partPath = `/${partNamespace}-part${lastPart + i}.xml`

        sitemaps.push({
          _sitemapName: partPath,
          lastmod: new Date().toISOString(),
        })
      }
    }
  }

  return sitemaps as unknown as SitemapIndexEntry[]
}

export async function fetchFromRedisForRegisterRoutes(config: ModuleRuntimeConfig): Promise<Record<string, string>> {
  const sitemaps = await prepareSitemapFromRedis(config, true)

  const sitemapsAsObj = sitemaps.reduce((acc, { _sitemapName, lastmod }) => {
    const key = _sitemapName.replace(/^\//, '').replace(/\.xml$/, '')
    acc[key] = { lastmod }
    return acc
  }, {})

  return sitemapsAsObj
}

export async function fetchFromRedis(config: ModuleRuntimeConfig, resolvers: NitroUrlResolvers, preRegistrationForFutureRoutes = false) {
  const sitemaps = await prepareSitemapFromRedis(config, preRegistrationForFutureRoutes)

  sitemaps.forEach((item) => {
    if (item._sitemapName != null) {
      item.sitemap = resolvers.canonicalUrlResolver(joinURL(config.sitemapsPathPrefix || '', item._sitemapName))
    }
  })

  return sitemaps
}
