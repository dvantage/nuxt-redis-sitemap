import { createError, defineEventHandler, getRouterParam } from 'h3'
import { withoutLeadingSlash, withoutTrailingSlash } from 'ufo'
import { useSitemapRuntimeConfig } from '../../utils'
import { createSitemap } from '../../sitemap/nitro'
import { fetchFromRedisByKeyNameAndPart } from '../../redis'

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
    && /-part/.test(sitemapName)
  ) {
    const regex = /^(.+)-part(\d+)$/
    const match = sitemapName.match(regex)

    //
    if (match && match[1] && match[1] in runtimeConfig.redis.keyName) {
      const [,namespace, part] = match
      const keyName = runtimeConfig.redis.keyName[namespace]
      const routes = await fetchFromRedisByKeyNameAndPart(runtimeConfig, keyName, Number(part))
      if (routes.length > 0) {
        sitemaps[sitemapName] = {
          sitemapName: sitemapName,
          fromRedis: true,
          urls: routes,
        }
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
