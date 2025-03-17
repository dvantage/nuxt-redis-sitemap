import { createError, defineEventHandler, getRouterParam } from 'h3'
import { withoutLeadingSlash, withoutTrailingSlash } from 'ufo'
import { useSitemapRuntimeConfig } from '../../utils'
import { createSitemap } from '../../sitemap/nitro'
import { fetchFromRedisByPart } from '../../redis'

export default defineEventHandler(async (e) => {
  const runtimeConfig = useSitemapRuntimeConfig(e)
  const { sitemaps } = runtimeConfig

  const sitemapName = withoutLeadingSlash(withoutTrailingSlash((getRouterParam(e, 'sitemap') || e.path)?.replace('.xml', '')
    .replace(runtimeConfig.sitemapsPathPrefix || '', '')))
  // check if sitemapName can be cast to a number safely
  const isChunking = typeof sitemaps.chunks !== 'undefined' && !Number.isNaN(Number(sitemapName))

  /**
   * REDIS
   */
  if (sitemapName && runtimeConfig.redis !== undefined && runtimeConfig.redis !== null
    && runtimeConfig.redis.useForSitemap
    && sitemapName.startsWith(`${runtimeConfig.redis.partNamespace}-part`)
  ) {
    const [routesPart] = sitemapName.match(/(\d{1,4})$/)
    const routes = await fetchFromRedisByPart(runtimeConfig, Number(routesPart))
    if (routes.length > 0) {
      sitemaps[sitemapName] = {
        sitemapName: sitemapName,
        fromRedis: true,
        urls: routes,
      }
    }
  }

  if (!sitemapName || (!(sitemapName in sitemaps) && !isChunking)) {
    return createError({
      statusCode: 404,
      message: `Sitemap "${sitemapName}" not found.`,
    })
  }
  return createSitemap(e, isChunking
    ? {
        ...sitemaps.chunks,
        sitemapName,
      }
    : sitemaps[sitemapName], runtimeConfig)
})
