# @donotdev/i18n

## Unreleased

### Minor Changes

- FAQSection: `gridCols` (same type as `Section`'s) passed to its Accordion, e.g. `[1, 1, 2, 2]` for 1 column on mobile/tablet and 2 on laptop/desktop. Absent: unchanged.
- FAQSection: `items` input (`{ question, answer }[]` of ReactNode, built by the app) for data-driven FAQs. Props are now a union: `items`, or `t` + `keyPrefix` (+ `maxIndex`); keys mode builds the same list internally and renders through the same path, output unchanged.

## 0.1.43

### Patch Changes

- Updated dependencies [a4c57d7]
- Updated dependencies [2b8210a]
  - @donotdev/components@0.1.44
  - @donotdev/utils@0.1.43
  - @donotdev/stores@0.1.43
