// GENERATED from ../../utils/src/common/headTags.ts by bun run bpr. Do not edit; edit the .ts and rerun bpr.

// packages/core/utils/src/common/arrayTranslations.ts
function translateArray(t, keyPrefix, maxIndex, options = {}) {
  const { minLength = 0, excludeEmpty = true, customFilter } = options;
  return Array.from({ length: maxIndex }, (_, index) => {
    const key = `${keyPrefix}.${index}`;
    return t(key);
  }).filter((item, index) => {
    const key = `${keyPrefix}.${index}`;
    if (item === key) {
      return false;
    }
    if (excludeEmpty && item.trim() === '') {
      return false;
    }
    if (item.length < minLength) {
      return false;
    }
    if (customFilter && !customFilter(item, index)) {
      return false;
    }
    return true;
  });
}

// packages/core/utils/src/common/headTags.ts
var PRERENDERED_HEAD_ELEMENT_ID = 'dndev-prerendered-head';
var SITE_LOGO_PATH = '/logo.svg';
function jsonScriptText(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
var meta = (key, value, content) => ({
  tag: 'meta',
  attributes: { [key]: value, content },
});
var jsonLdTag = (jsonLd) => ({
  tag: 'script',
  attributes: { type: 'application/ld+json' },
  text: jsonScriptText(jsonLd),
});
function buildBreadcrumbJsonLd(pathname, siteName, pageUrl, lastName) {
  const segments = pathname.split('/').filter(Boolean);
  const items = [
    { '@type': 'ListItem', position: 1, name: siteName, item: pageUrl('/') },
  ];
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name:
        isLast && lastName
          ? lastName
          : segment
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
      item: pageUrl(currentPath),
    });
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}
function recordHeadTags(seo) {
  const { title, description, image, type, jsonLd, breadcrumb } = seo;
  const tags = [{ tag: 'title', attributes: {}, text: title }];
  if (description) tags.push(meta('name', 'description', description));
  tags.push(meta('property', 'og:title', title));
  if (description) tags.push(meta('property', 'og:description', description));
  tags.push(meta('property', 'og:type', type));
  if (image) tags.push(meta('property', 'og:image', image));
  if (image) tags.push(meta('name', 'twitter:card', 'summary_large_image'));
  tags.push(meta('name', 'twitter:title', title));
  if (description) tags.push(meta('name', 'twitter:description', description));
  if (image) tags.push(meta('name', 'twitter:image', image));
  if (jsonLd) tags.push(jsonLdTag(jsonLd));
  if (breadcrumb) tags.push(jsonLdTag(breadcrumb));
  return tags;
}
function siteHeadTags(site) {
  const tags = [];
  if (site.url) {
    tags.push({
      tag: 'link',
      attributes: { rel: 'canonical', href: site.url },
    });
    tags.push(meta('property', 'og:url', site.url));
  }
  tags.push(meta('property', 'og:site_name', site.siteName));
  if (site.alternates) {
    for (const [language, href] of Object.entries(site.alternates)) {
      tags.push({
        tag: 'link',
        attributes: { rel: 'alternate', hreflang: language, href },
      });
    }
    const xDefault = site.alternates[site.defaultLanguage];
    if (xDefault) {
      tags.push({
        tag: 'link',
        attributes: { rel: 'alternate', hreflang: 'x-default', href: xDefault },
      });
    }
  }
  return tags;
}
var MAX_KEYWORDS = 20;
var EMPTY_WHEN_MISSING = { defaultValue: '' };
function resolveSeoField(seoValue, translationKey, t) {
  if (seoValue === null) return void 0;
  if (seoValue !== void 0) return seoValue;
  return t(translationKey, EMPTY_WHEN_MISSING) || void 0;
}
function readI18nSeoMeta(t, ns) {
  const translateOrEmpty = (key) => t(key, EMPTY_WHEN_MISSING);
  const field = (name) => translateOrEmpty(`${ns}:meta.${name}`) || void 0;
  const keywords = translateArray(
    translateOrEmpty,
    `${ns}:meta.keywords`,
    MAX_KEYWORDS
  );
  return {
    fullTitle: field('fullTitle'),
    image: field('image'),
    type: field('type'),
    keywords: keywords.length > 0 ? keywords : void 0,
    author: field('author'),
  };
}
function robotsContent(noindex, authOnly) {
  if (noindex === true) return 'noindex, nofollow';
  if (noindex === false) return null;
  return authOnly ? 'noindex' : null;
}
function routeTitle(input) {
  const { meta: routeMeta, ns, defaultNs, t, siteName } = input;
  const seo = routeMeta.seo;
  if (!ns && !defaultNs) return { title: seo?.fullTitle || siteName };
  const pageTitle = ns
    ? resolveSeoField(seo?.title, `${ns}:title`, t)
    : (seo?.title ?? void 0);
  const fullTitle =
    seo?.fullTitle || (ns ? readI18nSeoMeta(t, ns).fullTitle : void 0);
  return {
    title: fullTitle || (pageTitle ? `${pageTitle} | ${siteName}` : siteName),
    ...(pageTitle && { pageTitle }),
  };
}
function routeSeo(input) {
  const {
    meta: routeMeta,
    ns,
    defaultNs,
    t,
    siteName,
    baseUrl,
    url,
    defaultImage,
  } = input;
  const seo = routeMeta.seo;
  const textNs = ns ?? defaultNs;
  const metaObject = textNs ? readI18nSeoMeta(t, textNs) : null;
  const { title } = routeTitle({ meta: routeMeta, ns, defaultNs, t, siteName });
  const description = textNs
    ? resolveSeoField(seo?.description, `${textNs}:description`, t)
    : void 0;
  const image = seo?.image || metaObject?.image || defaultImage || void 0;
  const keywords = seo?.keywords || metaObject?.keywords;
  const author = routeMeta.author || metaObject?.author;
  return {
    title,
    ...(description && { description }),
    // Link-preview crawlers need an absolute URL
    ...(image && {
      image: image.startsWith('http') ? image : `${baseUrl}${image}`,
    }),
    url,
    type: seo?.type || metaObject?.type || 'website',
    robots: robotsContent(seo?.noindex ?? routeMeta.noindex, input.authOnly),
    ...(keywords && { keywords }),
    ...(author && { author }),
    ...(routeMeta.publishDate && { publishDate: routeMeta.publishDate }),
    ...(routeMeta.modifiedDate && { modifiedDate: routeMeta.modifiedDate }),
  };
}
function routeHeadTags(seo, site) {
  const { title, description, image, type, keywords, author } = seo;
  const tags = [{ tag: 'title', attributes: {}, text: title }];
  if (description) tags.push(meta('name', 'description', description));
  if (keywords) tags.push(meta('name', 'keywords', keywords.join(', ')));
  if (author) tags.push(meta('name', 'author', author));
  if (seo.robots) tags.push(meta('name', 'robots', seo.robots));
  tags.push(meta('property', 'og:title', title));
  if (description) tags.push(meta('property', 'og:description', description));
  tags.push(meta('property', 'og:type', type));
  if (image) {
    tags.push(meta('property', 'og:image', image));
    tags.push(meta('property', 'og:image:width', '1200'));
    tags.push(meta('property', 'og:image:height', '630'));
  }
  if (type === 'article') {
    if (author) tags.push(meta('property', 'article:author', author));
    if (seo.publishDate)
      tags.push(meta('property', 'article:published_time', seo.publishDate));
    if (seo.modifiedDate)
      tags.push(meta('property', 'article:modified_time', seo.modifiedDate));
  }
  tags.push(meta('name', 'twitter:card', 'summary_large_image'));
  tags.push(meta('name', 'twitter:title', title));
  if (description) tags.push(meta('name', 'twitter:description', description));
  if (image) tags.push(meta('name', 'twitter:image', image));
  if (author) tags.push(meta('name', 'twitter:creator', author));
  if (image?.startsWith('http')) {
    tags.push({
      tag: 'link',
      attributes: { rel: 'dns-prefetch', href: new URL(image).origin },
    });
  }
  if (seo.url) {
    tags.push(
      jsonLdTag({
        '@context': 'https://schema.org',
        '@type': type === 'article' ? 'Article' : 'WebPage',
        name: title,
        ...(description && { description }),
        url: seo.url,
        ...(image && { image }),
        ...(type === 'article' && {
          ...(author && { author: { '@type': 'Person', name: author } }),
          ...(seo.publishDate && { datePublished: seo.publishDate }),
          ...(seo.modifiedDate && { dateModified: seo.modifiedDate }),
        }),
        publisher: {
          '@type': 'Organization',
          name: site.siteName,
          logo: {
            '@type': 'ImageObject',
            // Absolute: schema.org consumers (Google) ignore a relative logo URL
            url: `${site.baseUrl}${SITE_LOGO_PATH}`,
          },
        },
      })
    );
  }
  return tags;
}
var FAVICON_DEFAULTS = {
  enabled: true,
  themeColor: '#2563eb',
  backgroundColor: '#ffffff',
  includeManifestIcons: true,
  includeMSIcons: false,
};
function resolveFaviconFiles(exists) {
  const file = (path) => (exists(path) ? path : void 0);
  return {
    svg: file('/favicon.svg'),
    ico: file('/favicon.ico'),
    png16: file('/favicon-16x16.png'),
    png32: file('/favicon-32x32.png'),
    apple180: file('/apple-touch-icon.png'),
    android192: file('/icon-192x192.png'),
    android512: file('/icon-512x512.png'),
  };
}
var icon = (href, type, sizes) => ({
  tag: 'link',
  attributes: { rel: 'icon', type, ...(sizes && { sizes }), href },
});
function faviconHeadTags(set, config) {
  const { enabled, appName, themeColor, includeManifestIcons, includeMSIcons } =
    config;
  if (enabled === false) return [];
  const tags = [];
  if (set.svg) tags.push(icon(set.svg, 'image/svg+xml'));
  if (set.ico) tags.push(icon(set.ico, 'image/x-icon'));
  if (set.png16) tags.push(icon(set.png16, 'image/png', '16x16'));
  if (set.png32) tags.push(icon(set.png32, 'image/png', '32x32'));
  if (set.apple180) {
    tags.push({
      tag: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: set.apple180,
      },
    });
    if (appName) tags.push(meta('name', 'apple-mobile-web-app-title', appName));
  }
  if (includeManifestIcons) {
    if (set.android192) tags.push(icon(set.android192, 'image/png', '192x192'));
    if (set.android512) tags.push(icon(set.android512, 'image/png', '512x512'));
  }
  if (includeMSIcons && set.png32) {
    tags.push(meta('name', 'msapplication-TileImage', set.png32));
    if (themeColor)
      tags.push(meta('name', 'msapplication-TileColor', themeColor));
  }
  if (themeColor) tags.push(meta('name', 'theme-color', themeColor));
  tags.push(meta('name', 'color-scheme', 'light dark'));
  return tags;
}
var FONT_STYLE_ID = 'dndev-fonts';
function fontPreloadHeadTags(hrefs) {
  return hrefs.map((href) => ({
    tag: 'link',
    attributes: {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href,
      crossorigin: 'anonymous',
    },
  }));
}
export {
  FAVICON_DEFAULTS,
  FONT_STYLE_ID,
  PRERENDERED_HEAD_ELEMENT_ID,
  SITE_LOGO_PATH,
  buildBreadcrumbJsonLd,
  faviconHeadTags,
  fontPreloadHeadTags,
  jsonScriptText,
  readI18nSeoMeta,
  recordHeadTags,
  resolveFaviconFiles,
  resolveSeoField,
  robotsContent,
  routeHeadTags,
  routeSeo,
  routeTitle,
  siteHeadTags,
};
