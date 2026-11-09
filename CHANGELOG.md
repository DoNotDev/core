# @donotdev/core

## 0.1.48

### Patch Changes

- `CreateCheckoutSessionRequestSchema` keeps the 0.1.x fields (`priceId`, `unitAmount`, `productName`, `currency`, `mode`, `userId`, `productId`, `userEmail`) instead of stripping them.
- New `BeforeCheckoutOptions`: `BeforeCheckoutHook`'s second argument is the normalized request plus the 0.1.x checkout options (`mode`, `priceId`, ...); hooks typed with `CheckoutOptions` keep compiling. `BeforeCheckoutResult.overrides` applies again to 0.1.x dynamic pricing.
- StripeOrder shipping: `allowedCountries` must be uppercase ISO 3166-1 alpha-2 codes, `shippingRateIds` holds at most 5 (`MAX_SHIPPING_RATE_IDS`), matching Stripe's Checkout Session limits.
- Next discovery runs once per build again: the `.dndev-build` marker is now overwritten (it was written once, ever, so every next.config evaluation re-ran discovery).
- Next discovery no longer deletes `src/config/dndev-config-*.js` and the public manifests before regenerating them. Files are overwritten in place and only artifacts the run did not rewrite are removed afterwards, so a dev server compiling while another Next process runs discovery stops failing with `Module not found: '../config/dndev-config-*.js'`.
- `PathResolver.write` / `writeSync` end JSON files with a trailing newline.
- Next route generation removes the generated `*PageClient.tsx` of a deleted page along with its `page.tsx`: the orphan wrapper imported the missing page and broke the type check.

## 0.1.43

### Patch Changes

- 98d641c: Add puppeteer to dependencies-matrix for all Vite templates and fix loadPuppeteer to use sync require.resolve before dynamic import, preventing process hang when puppeteer is missing.
- a4c57d7: bugfixes and performance upgrades
- Updated dependencies [064cfbb]
- Updated dependencies [a4c57d7]
- Updated dependencies [2b8210a]
  - @donotdev/schemas@0.1.43
  - @donotdev/components@0.1.44
  - @donotdev/hooks@0.1.43
  - @donotdev/i18n@0.1.43
  - @donotdev/utils@0.1.43
  - @donotdev/stores@0.1.43
