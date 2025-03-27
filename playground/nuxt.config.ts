import { resolve } from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'
import { defineNuxtModule } from '@nuxt/kit'
import { startSubprocess } from '@nuxt/devtools-kit'
import NuxtSitemap from '../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtSitemap,
    '@nuxtjs/robots',
    '@nuxtjs/i18n',
    '@nuxt/content',
    '@nuxt/ui',
    /**
     * Start a sub Nuxt Server for developing the client
     *
     * The terminal output can be found in the Terminals tab of the devtools.
     */
    defineNuxtModule({
      setup(_, nuxt) {
        if (!nuxt.options.dev)
          return

        const subprocess = startSubprocess(
          {
            command: 'npx',
            args: ['nuxi', 'dev', '--port', '3030'],
            cwd: resolve(__dirname, '../client'),
          },
          {
            id: 'sitemap',
            name: 'Sitemap Client Dev',
          },
        )
        subprocess.getProcess().stdout?.on('data', (data) => {
          // eslint-disable-next-line no-console
          console.log(` sub: ${data.toString()}`)
        })

        process.on('exit', () => {
          subprocess.terminate()
        })

        // process.getProcess().stdout?.pipe(process.stdout)
        // process.getProcess().stderr?.pipe(process.stderr)
      },
    }),
  ],

  site: {
    url: 'https://sitemap-edge-demo.vercel.app/',
  },

  content: {
    documentDriven: true,
  },

  ignorePrefix: 'ignore-',

  routeRules: {
    '/api/prerendered': {
      prerender: true,
    },
    '/secret': {
      robots: false,
    },
    '/users-test/*': {
      sitemap: {
        lastmod: new Date(2023, 1, 21, 4, 50, 52),
        changefreq: 'weekly',
        priority: 0.3,
        images: [],
      },
    },
    '/should-not-be-in-sitemap/*': {},
    '/about-redirect': {
      redirect: '/about',
    },
    '/about': {
      sitemap: {
        lastmod: '2023-01-21',
        changefreq: 'daily',
        priority: 0.3,
        images: [
          {
            loc: 'https://example.com/image.jpg',
          },
          {
            loc: 'https://example.com/image2.jpg',
          },
        ],
      },
    },
  },

  experimental: {
    inlineRouteRules: true,
  },

  compatibilityDate: '2025-01-17',

  nitro: {
    typescript: {
      internalPaths: true,
    },
    plugins: ['plugins/sitemap.ts'],
    prerender: {
      routes: [
        // '/sitemap_index.xml',
        '/prerender',
        '/prerender-video',
        '/should-be-in-sitemap',
        '/foo.bar/',
        '/test.doc',
        '/api/prerendered',
      ],
      failOnError: false,
    },
  },
  // app: {
  //   baseURL: '/base'
  // },

  robots: {
    indexable: true,
  },

  sitemap: {
    redis: {
      useForSitemap: true,
      useGzip: true,
      keyName: { products: 'product-redis-key', users: 'users-redis-key' },
      config: {
        host: '127.0.0.1',
        port: 6379,
        password: '123',
      },
    },
    xsl: false,
    sitemapsPathPrefix: '/',
    experimentalWarmUp: true,
    experimentalCompression: true,
    debug: true,
    cacheMaxAgeSeconds: 10,
    sitemaps: {
      'static-pages': {
        includeAppSources: true,
        exclude: ['/en/blog/**', '/fr/blog/**', '/blog/**', /.*hide-me.*/g, '/about'],
      },
      'products-part10': {
        urls: [
          {
            loc: '/product/432423',
            lastmod: '2023-02-21T08:50:52.000Z',
          },
          {
            loc: '/product/8888',
            lastmod: '2023-02-21T08:50:52.000Z',
          },
        ],
      },
    },
  },
})
