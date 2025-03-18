import { defineNitroPlugin } from 'nitropack/runtime'
import { useSitemapRuntimeConfig } from '../utils'
import sitemapHandler from '../routes/sitemap/[sitemap].xml'
import { fetchFromRedisForRegisterRoutes } from '#sitemap/server/redis'

export default defineNitroPlugin(async (nitroApp) => {
  const config = useSitemapRuntimeConfig()

  if (config.redis && config.redis.useForSitemap) {
    const sitemapsFromRedis = await fetchFromRedisForRegisterRoutes(config)
    const sitemapsForEachRoute = {
      ...config.sitemaps,
      ...sitemapsFromRedis,
    }

    for (const sitemapName of Object.keys(sitemapsForEachRoute || {})) {
      nitroApp.router.get(`/${sitemapName}.xml`, sitemapHandler)
    }
  }
})
