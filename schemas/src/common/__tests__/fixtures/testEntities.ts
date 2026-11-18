// packages/core/schemas/src/common/__tests__/fixtures/testEntities.ts

/**
 * @fileoverview Test entities: the one set of entities every framework test uses
 * @description Built with the real `defineEntity()`, so importing this module registers
 * every entity under its collection (`getEntityByCollection`, which the CRUD write rules
 * read: `entitySchemasOf`, crud/src/CrudService.writeRules.ts). A test never defines an
 * entity inline: it imports the one named for the case it exercises.
 *
 * - **Import:** `import { productEntity } from '@dndev/test-entities';` from any package's
 *   tests (alias in `vitest.shared.ts` and `packages/tooling/vitest.config.ts`). It
 *   imports `defineEntity` by relative path, so a test that mocks `@donotdev/core` still
 *   gets real entities.
 * - **Isolation:** the registry is a global singleton; vitest runs each test file in its
 *   own worker (`isolate`, the default), so registrations never leak between files.
 *   Within a file, every entity here is registered once, at import; collections are
 *   unique, so no entity replaces another. No reset helper exists or is needed.
 * - **Adding a case:** reuse an entity when its fields already exercise the case. Else add
 *   one in the matching section: minimal fields, a collection no other entity uses, a
 *   JSDoc line naming the rule or behaviour. Never import app entities (shopkb): shapes
 *   are modelled on them, kept generic. A definition whose call is the subject of the
 *   test (`defineEntity` throwing on invalid input) stays in that test.
 * - **Rules:** CRUD rules 1-9, `packages/features/crud/guidelines/CRUD.md` (SSOT:
 *   `core/schemas/src/common/crud/`).
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import { FIELD_TYPES } from '../../../../../types/src/crud/constants';
import { when } from '../../../../../utils/src/common/conditions';
import { defineEntity } from '../../defineEntity';

// =============================================================================
// Shop domain: references, parent / child rows, 1:1 extensions
// (modelled on brand, product + productOffer, supplyOrder + supplyOrderLine)
// =============================================================================

/**
 * Reference target: a reference to `brands` shows the brand `name` (label resolution);
 * images (jsonb column), a translated description (`descriptionI18n` companion).
 */
export const brandEntity = defineEntity({
  name: 'Brand',
  collection: 'brands',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'guest', validation: { required: true } },
    images: { name: 'images', label: 'images', type: 'images', visibility: 'guest' },
    description: { name: 'description', label: 'description', type: 'textarea', visibility: 'guest', i18n: true },
  },
});

/**
 * Catalogue product: the extended record (1:1 `extend`), the other side of a link table,
 * a `brandId` reference; its card (`listCardFields`) gives the SEO / llms.txt text.
 */
export const productEntity = defineEntity({
  name: 'Product',
  collection: 'products',
  listCardFields: {
    title: ['name'],
    subtitle: ['size'],
    content: ['images', 'shortDescription'],
    footer: ['slug', 'rrpInclVat'],
  },
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'guest' },
    slug: { name: 'slug', label: 'slug', type: 'text', visibility: 'guest' },
    size: { name: 'size', label: 'size', type: 'text', visibility: 'guest' },
    brandId: { name: 'brandId', label: 'brandId', type: 'reference', visibility: 'guest', validation: { reference: 'brands' } },
    images: { name: 'images', label: 'images', type: 'images', visibility: 'guest' },
    shortDescription: { name: 'shortDescription', label: 'shortDescription', type: 'textarea', visibility: 'guest' },
    description: { name: 'description', label: 'description', type: 'richtext', visibility: 'guest' },
    rrpInclVat: { name: 'rrpInclVat', label: 'rrpInclVat', type: 'currency', visibility: 'guest' },
  },
});

/** 1:1 extension of a product (`extend`, link field `productId`): private, required price. */
export const productOfferEntity = defineEntity({
  name: 'ProductOffer',
  collection: 'product_offers',
  fields: {
    productId: { name: 'productId', label: 'productId', type: 'reference', visibility: 'admin', validation: { reference: 'products', required: true } },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'admin', validation: { required: true } },
  },
});

/** 1:1 extension an admin may not read (`access.read: 'super'`): no fields, no read, no write. */
export const productCostEntity = defineEntity({
  name: 'ProductCost',
  collection: 'product_costs',
  access: { read: 'super' },
  fields: {
    productId: { name: 'productId', label: 'productId', type: 'reference', visibility: 'admin', validation: { reference: 'products' } },
    cost: { name: 'cost', label: 'cost', type: 'number', visibility: 'admin' },
  },
});

/** Reference target of a field that is not of type `reference` (`apartmentEntity.owner_ref`); seeded first. */
export const ownerEntity = defineEntity({
  name: 'Owner',
  collection: 'owners',
  fields: {
    fullName: { name: 'fullName', label: 'Name', type: 'text', visibility: 'admin', validation: { required: true, maxLength: 20 } },
    phone: { name: 'phone', label: 'Phone', type: 'tel', visibility: 'admin' },
    email: { name: 'email', label: 'Email', type: 'email', visibility: 'admin', validation: { required: true } },
  },
});

/**
 * A custom field type with `validation.reference` is a reference (parent field, reference
 * predicate, seed order); custom types with a value schema, every write class (seed rows).
 */
export const apartmentEntity = defineEntity({
  name: 'Apartment',
  collection: 'apartments',
  fields: {
    owner_ref: { name: 'owner_ref', label: 'Owner', type: 'owner-select', visibility: 'admin', validation: { required: true, reference: 'owners' } },
    district: { name: 'district', label: 'District', type: 'paris-district', visibility: 'admin', validation: { schema: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)) } },
    kind: { name: 'kind', label: 'Kind', type: 'select', visibility: 'admin', validation: { options: [{ value: 't1', label: 'T1' }, { value: 't2', label: 'T2' }] } },
    address: { name: 'address', label: 'Address', type: 'address', visibility: 'admin' },
    opensAt: { name: 'opensAt', label: 'Opens', type: 'time', visibility: 'admin' },
    total: { name: 'total', label: 'Total', type: 'number', visibility: 'admin', editable: 'computed' },
    revision: { name: 'revision', label: 'Rev', type: 'number', visibility: 'admin', editable: 'generated' },
    secret: { name: 'secret', label: 'Secret', type: 'text', visibility: 'hidden' },
  },
});

/** Rows written after their product (`bulkAcross` waves, `dependsOn`); no required field. */
export const stockMovementEntity = defineEntity({
  name: 'StockMovement',
  collection: 'stock_movements',
  fields: {
    productId: { name: 'productId', label: 'productId', type: 'reference', visibility: 'admin', validation: { reference: 'products' } },
    quantity: { name: 'quantity', label: 'quantity', type: 'number', visibility: 'admin' },
  },
});

/** Parent record of child rows (`orderLineEntity.orderId`). */
export const orderEntity = defineEntity({
  name: 'Order',
  collection: 'orders',
  fields: {
    title: { name: 'title', label: 'title', type: 'text', visibility: 'admin' },
  },
});

/**
 * Child rows (1:N) of an order, saved with it; required reference + quantity, a field only
 * a super admin edits (`editable: 'super'`).
 */
export const orderLineEntity = defineEntity({
  name: 'OrderLine',
  collection: 'order_lines',
  access: { create: 'admin', update: 'admin', delete: 'admin' },
  fields: {
    orderId: { name: 'orderId', label: 'orderId', type: 'reference', visibility: 'admin', validation: { reference: 'orders' } },
    productId: { name: 'productId', label: 'productId', type: 'reference', visibility: 'admin', validation: { reference: 'products', required: true } },
    quantity: { name: 'quantity', label: 'quantity', type: 'number', visibility: 'admin', validation: { required: true } },
    note: { name: 'note', label: 'note', type: 'text', visibility: 'admin', editable: 'super' },
  },
});

/** Child rows with an app status (`sold`, CRUD rule 6: strict like `available`). */
export const soldOrderLineEntity = defineEntity({
  name: 'SoldOrderLine',
  collection: 'sold_order_lines',
  access: { create: 'admin', update: 'admin', delete: 'admin' },
  fields: {
    ...orderLineEntity.fields,
    status: { name: 'status', label: 'status', type: 'select', visibility: 'admin', validation: { options: [{ value: 'sold', label: 'Sold' }] } },
  },
});

// =============================================================================
// CRUD rules (core/schemas crud/): status, validation, unknown fields
// =============================================================================

/**
 * The CRUD rule cases (crud/__tests__/rules.cases.ts): one required field, one optional
 * field, an app status `sold`. Default status `available` (7), draft saves incomplete (5),
 * custom status strict (6), logical delete (3), unknown fields (8).
 */
export const noteEntity = defineEntity({
  name: 'Note',
  collection: 'notes',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true } },
    body: { name: 'body', label: 'Body', type: 'text', visibility: 'user' },
    status: {
      name: 'status',
      label: 'Status',
      type: 'select',
      visibility: 'admin',
      validation: { options: [{ value: 'sold', label: 'Sold' }] },
    },
  },
});

/** Bulk writes of one collection (`bulk`): one optional field, every row valid. */
export const eventEntity = defineEntity({
  name: 'Event',
  collection: 'events',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'guest' },
  },
});

/** PII encryption per write schema: one secret per schema the rules may pick (create / draft / update). */
export const piiEventEntity = defineEntity({
  name: 'PiiEvent',
  collection: 'pii_events',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'guest' },
    createSecret: { name: 'createSecret', label: 'C', type: 'text', visibility: 'guest' },
    draftSecret: { name: 'draftSecret', label: 'D', type: 'text', visibility: 'guest' },
    updateSecret: { name: 'updateSecret', label: 'U', type: 'text', visibility: 'guest' },
  },
});

/** PII field (`security.piiFields`): encrypted before the write; every field guest (direct adapters write it). */
export const piiSecretEntity = defineEntity({
  name: 'PiiSecret',
  collection: 'pii_secrets',
  security: { piiFields: ['secret'] },
  fields: {
    secret: { name: 'secret', label: 'secret', type: 'text', visibility: 'guest' },
    status: { name: 'status', label: 'status', type: 'select', visibility: 'guest' },
  },
});

/**
 * Written by a direct (client) adapter: every field guest, `status` included
 * (`assertCanAccess` refuses any other field visibility). Structured (`map`) and `Date`
 * values (`validation.schema: v.date()`).
 */
export const catalogItemEntity = defineEntity({
  name: 'CatalogItem',
  collection: 'catalog_items',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'guest' },
    details: { name: 'details', label: 'details', type: 'map', visibility: 'guest' },
    releasedAt: { name: 'releasedAt', label: 'releasedAt', type: 'timestamp', visibility: 'guest', validation: { schema: v.date() } },
    status: { name: 'status', label: 'status', type: 'select', visibility: 'guest' },
  },
});

/** Row linked to a catalog item (`dependsOn`, pre-minted ids), writable by a direct adapter. */
export const catalogPriceEntity = defineEntity({
  name: 'CatalogPrice',
  collection: 'catalog_prices',
  fields: {
    itemId: { name: 'itemId', label: 'itemId', type: 'reference', visibility: 'guest', validation: { reference: 'catalog_items', required: true } },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'guest' },
    status: { name: 'status', label: 'status', type: 'select', visibility: 'guest' },
  },
});

/** A field above guest visibility: writes are gated by the adapter's field-visibility support. */
export const restrictedSecretEntity = defineEntity({
  name: 'RestrictedSecret',
  collection: 'restricted_secrets',
  fields: {
    secret: { name: 'secret', label: 'secret', type: 'text', visibility: 'user' },
  },
});

/** Patches validated like the server: a required field, an optional one (drafts, publish check). */
export const listingEntity = defineEntity({
  name: 'Listing',
  collection: 'listings',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true } },
    rooms: { name: 'rooms', label: 'Rooms', type: 'number', visibility: 'user' },
  },
});

/** A collection named like an `Object.prototype` key: results stay own, null-prototype maps. */
export const prototypeNamedEntity = defineEntity({
  name: 'PrototypeNamed',
  collection: '__proto__',
  fields: {},
});

// =============================================================================
// Forms (useEntityForm): conditions, projection of the written fields
// =============================================================================

const french = when('billingCountry').equals('FR');
const foreign = when('billingCountry').notEquals('FR');

/**
 * Conditional fields (`conditions.visible` / `conditions.required`) on every field kind the
 * form projects: required by condition, hidden, generated, translated, overridden.
 */
export const conditionalAccountEntity = defineEntity({
  name: 'ConditionalProAccount',
  collection: 'conditional_pro_accounts',
  fields: {
    companyName: { name: 'companyName', label: 'Company', type: 'text', visibility: 'user', validation: { required: true } },
    billingCountry: { name: 'billingCountry', label: 'Country', type: 'text', visibility: 'user' },
    siret: { name: 'siret', label: 'SIRET', type: 'text', visibility: 'user',
      validation: { schema: v.pipe(v.string(), v.regex(/^\d{14}$/)) },
      conditions: { visible: french, required: french } },
    companyId: { name: 'companyId', label: 'Identifier', type: 'text', visibility: 'user',
      validation: { minLength: 3 }, conditions: { visible: foreign, required: foreign } },
    shippingSameAsBilling: { name: 'shippingSameAsBilling', label: 'Same address', type: 'switch', visibility: 'user' },
    shippingCity: { name: 'shippingCity', label: 'City', type: 'text', visibility: 'user', validation: { maxLength: 5 },
      conditions: { visible: when('shippingSameAsBilling').equals(false) } },
    cgvAcceptedVersion: { name: 'cgvAcceptedVersion', label: 'CGV', type: 'text', visibility: 'user', validation: { required: true },
      conditions: { visible: when('id').exists() } },
    staticSecret: { name: 'staticSecret', label: 'Secret', type: 'text', visibility: 'hidden' },
    staticGenerated: { name: 'staticGenerated', label: 'Generated', type: 'text', visibility: 'user', editable: 'generated' },
    privateNote: { name: 'privateNote', label: 'Private', type: 'text', visibility: 'hidden', conditions: { visible: foreign } },
    generatedCode: { name: 'generatedCode', label: 'Generated', type: 'text', visibility: 'user', editable: 'generated', conditions: { visible: foreign } },
    translatedNote: { name: 'translatedNote', label: 'Translated', type: 'text', visibility: 'user', i18n: true, conditions: { visible: foreign } },
    optionalOverride: { name: 'optionalOverride', label: 'Override', type: 'text', visibility: 'user', validation: { required: true },
      conditions: { required: foreign } },
  },
});

/**
 * The fields a form writes (CRUD rule 9): translated (`i18n`), generated, `editable: false`,
 * computed, admin-only.
 */
export const editableModesEntity = defineEntity({
  name: 'ProjectionForm',
  collection: 'projection_forms',
  fields: {
    title: { name: 'title', label: 'title', type: 'text', visibility: 'user', i18n: true },
    revision: { name: 'revision', label: 'revision', type: 'number', visibility: 'user', editable: 'generated' },
    code: { name: 'code', label: 'code', type: 'text', visibility: 'user', editable: false },
    total: { name: 'total', label: 'total', type: 'number', visibility: 'user', editable: 'computed' },
    adminNote: { name: 'adminNote', label: 'note', type: 'text', visibility: 'user', editable: 'admin' },
  },
});

/**
 * `editable` modes (CRUD rule 9), one field each: unset, true, false, computed, generated,
 * create-only, a role (guest / user / admin / an app role / super), technical with and
 * without a role; a backend-generated name (`createdAt`) set editable.
 */
export const editableMatrixEntity = defineEntity({
  name: 'EditableMatrix',
  collection: 'editable_matrix',
  fields: {
    editableUnset: { name: 'editableUnset', label: 'f', type: 'text', visibility: 'guest' },
    editableTrue: { name: 'editableTrue', label: 'f', type: 'text', visibility: 'guest', editable: true },
    editableFalse: { name: 'editableFalse', label: 'f', type: 'text', visibility: 'guest', editable: false },
    computed: { name: 'computed', label: 'f', type: 'text', visibility: 'guest', editable: 'computed' },
    generated: { name: 'generated', label: 'f', type: 'text', visibility: 'guest', editable: 'generated' },
    createOnly: { name: 'createOnly', label: 'f', type: 'text', visibility: 'guest', editable: 'create-only' },
    guestRole: { name: 'guestRole', label: 'f', type: 'text', visibility: 'guest', editable: 'guest' },
    userRole: { name: 'userRole', label: 'f', type: 'text', visibility: 'guest', editable: 'user' },
    adminRole: { name: 'adminRole', label: 'f', type: 'text', visibility: 'guest', editable: 'admin' },
    // why: an app-defined role, outside the built-in role names
    moderatorRole: { name: 'moderatorRole', label: 'f', type: 'text', visibility: 'guest', editable: 'moderator' as 'admin' },
    superRole: { name: 'superRole', label: 'f', type: 'text', visibility: 'guest', editable: 'super' },
    technicalUnset: { name: 'technicalUnset', label: 'f', type: 'text', visibility: 'technical' },
    technicalAdmin: { name: 'technicalAdmin', label: 'f', type: 'text', visibility: 'technical', editable: 'admin' },
    createdAt: { editable: true },
  },
});

/** A required field and the framework status only (admin-editable): drafts keep the draft rules. */
export const requiredTitleEntity = defineEntity({
  name: 'StrictDraft',
  collection: 'strict_drafts',
  fields: {
    title: { name: 'title', label: 'title', type: 'text', visibility: 'user', validation: { required: true } },
  },
});

// =============================================================================
// Single-record writes and reads (useCrud, CrudService)
// =============================================================================

/**
 * Single-record writes and reads (`add` / `set` / `update`, `useCrudDoc`): optional fields,
 * default status (CRUD rule 7); `model` is translated (`i18n: true`, read in the language).
 */
export const carEntity = defineEntity({
  name: 'Car',
  collection: 'cars',
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest' },
    model: { name: 'model', label: 'Model', type: 'text', visibility: 'guest', i18n: true },
  },
});

// =============================================================================
// Bulk patches, filters and URL state
// =============================================================================

/** Patches validated like the server, parse output written: a required field and a `validation.schema` transform (upper-case code). */
export const uppercaseCodeEntity = defineEntity({
  name: 'BulkPatchProbe',
  collection: 'bulk_patch_probe',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true } },
    rooms: { name: 'rooms', label: 'Rooms', type: 'number', visibility: 'user' },
    code: {
      name: 'code',
      label: 'Code',
      type: 'text',
      visibility: 'user',
      validation: { schema: v.pipe(v.string(), v.transform((s) => s.toUpperCase())) },
    },
  },
});

/** Filter state synced to the URL: text, select, multiselect and number fields. */
export const urlFilterProductEntity = defineEntity({
  name: 'UrlProduct',
  collection: 'url_products',
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest' },
    type: {
      name: 'type',
      label: 'Type',
      type: 'select',
      visibility: 'guest',
      validation: {
        options: [
          { value: 'toner', label: 'Toner' },
          { value: 'serum', label: 'Serum' },
        ],
      },
    },
    skinTypes: {
      name: 'skinTypes',
      label: 'Skin types',
      type: 'multiselect',
      visibility: 'guest',
      validation: {
        options: [
          { value: 'dry', label: 'Dry' },
          { value: 'oily', label: 'Oily' },
        ],
      },
    },
    price: {
      name: 'price',
      label: 'Price',
      type: 'number',
      visibility: 'guest',
    },
  },
});

/** A filterable status field with app options (`active` / `inactive`) visible to users, next to a text field. */
export const statusFilterEntity = defineEntity({
  name: 'Product',
  collection: 'status_filter_products',
  fields: {
    title: {
      name: 'title',
      label: 'Title',
      type: 'text',
      visibility: 'user',
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'select',
      visibility: 'user',
      validation: {
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    },
  },
});

/** Filters with exact counts: select (`toner` vs `toner_pad`), multiselect with a wildcard value (`filter: { wildcard }`), reference, text. */
export const filterProductEntity = defineEntity({
  name: 'FilterProduct',
  collection: 'filter_products',
  fields: {
    type: {
      name: 'type',
      label: 'Type',
      type: 'select',
      visibility: 'guest',
      validation: {
        options: [
          { value: 'toner', label: 'options.type.toner' },
          { value: 'toner_pad', label: 'options.type.toner_pad' },
          { value: 'serum', label: 'options.type.serum' },
        ],
      },
    },
    skinTypes: {
      name: 'skinTypes',
      label: 'Skin types',
      type: 'multiselect',
      visibility: 'guest',
      filter: { wildcard: 'all' },
      validation: {
        options: [
          { value: 'all', label: 'options.skin.all' },
          { value: 'dry', label: 'options.skin.dry' },
          { value: 'oily', label: 'options.skin.oily' },
          { value: 'sensitive', label: 'options.skin.sensitive' },
        ],
      },
    },
    brandId: {
      name: 'brandId',
      label: 'Brand',
      type: 'reference',
      visibility: 'guest',
      validation: { reference: 'filter_brands' },
    },
    size: { name: 'size', label: 'Size', type: 'text', visibility: 'guest' },
  },
});

/** Nothing filterable for the viewer: one admin-only select without options. */
export const adminOnlyFieldEntity = defineEntity({
  name: 'FilterAdminOnly',
  collection: 'filter_admin_only',
  fields: {
    secret: { name: 'secret', label: 'Secret', type: 'select', visibility: 'admin' },
  },
});

// =============================================================================
// Forms (useEntityForm): drafts, navigation, scope, translations, initial values
// =============================================================================

/** Optimistic leave on save (`successPath`): one required field. */
export const leaveOnSaveEntity = defineEntity({
  name: 'LeaveOnSave', collection: 'leave_on_save',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true } },
  },
});

/** Resolver of the written fields: app status options, required fields, `editable` admin / computed / generated. */
export const editableResolverEntity = defineEntity({
  name: 'TestApartment',
  collection: 'test_apartments',
  fields: {
    status: {
      name: 'status',
      label: 'Status',
      type: 'select',
      visibility: 'admin',
      validation: {
        options: [
          { value: 'available', label: 'Available' },
          { value: 'reserved', label: 'Reserved' },
        ],
      },
    },
    reference: {
      name: 'reference',
      label: 'Reference',
      type: 'text',
      visibility: 'guest',
      validation: { required: true, minLength: 1 },
    },
    rent: {
      name: 'rent',
      label: 'Rent',
      type: 'currency',
      visibility: 'guest',
      editable: 'admin',
      validation: { required: true, min: 0 },
    },
    district_code: {
      name: 'district_code',
      label: 'District',
      type: 'number',
      visibility: 'guest',
      editable: 'computed',
      validation: { required: true },
    },
    rent_cc: {
      name: 'rent_cc',
      label: 'Rent CC',
      type: 'currency',
      visibility: 'guest',
      editable: 'generated',
      validation: { required: false },
    },
    notes: {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      visibility: 'admin',
      validation: { required: false },
    },
  },
});

/**
 * Multi-tenant scope (`scope`): the scope field (technical, create-only) is never in form
 * state; writes inject the provider's value (`injectScope`).
 */
export const scopedEntity = defineEntity({
  name: 'ScopedFormProbe',
  collection: 'scoped_records',
  scope: { field: 'companyId', provider: 'company' },
  fields: {
    label: { name: 'label', label: 'label', type: 'text', visibility: 'user', validation: { required: true } },
  },
});

/** Type-level assignability of forms: a required reference (`options.fieldSpecific.collection`), a create-only field. */
export const movementEntity = defineEntity({
  name: 'AssignabilityMovement',
  collection: 'assignability_movements',
  fields: {
    productId: {
      name: 'productId',
      label: 'productId',
      type: 'reference',
      visibility: 'user',
      validation: { required: true },
      options: { fieldSpecific: { collection: 'assignability_offers' } },
    },
    quantity: {
      name: 'quantity',
      label: 'quantity',
      type: 'number',
      visibility: 'user',
      validation: { required: true },
    },
    code: {
      name: 'code',
      label: 'code',
      type: 'text',
      visibility: 'user',
      editable: 'create-only',
    },
    note: { name: 'note', label: 'note', type: 'textarea', visibility: 'user' },
  },
});

/** Local drafts acknowledged by a save: required text, upload (`image`) and structured (`address`) values. */
export const draftAcknowledgementEntity = defineEntity({
  name: 'DraftAcknowledgement', collection: 'draft_acknowledgements',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true } },
    note: { name: 'note', label: 'Note', type: 'text', visibility: 'user' },
    image: { name: 'image', label: 'Image', type: 'image', visibility: 'user' },
    address: { name: 'address', label: 'Address', type: 'address', visibility: 'user', validation: {
      schema: v.object({ street: v.string(), city: v.string() }),
    } },
  },
});

/** Page state saved in the form draft (`useFormDraftState`): one required field. */
export const pageDraftEntity = defineEntity({
  name: 'PageDraft', collection: 'page_drafts',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true } },
  },
});

/** Entity translations: its own namespace (`form-shop`). */
export const shopNamespaceEntity = defineEntity({
  name: 'FormTranslationShop',
  namespace: 'form-shop',
  collection: 'form_translation_shop',
  fields: {
    name: { name: 'name', label: 'fields.name', type: 'text', visibility: 'guest' },
  },
});

/** Entity translations: a second namespace (`form-admin`) on the same page. */
export const adminNamespaceEntity = defineEntity({
  name: 'FormTranslationAdmin',
  namespace: 'form-admin',
  collection: 'form_translation_admin',
  fields: {
    name: { name: 'name', label: 'fields.name', type: 'text', visibility: 'guest' },
  },
});

/** Fields written per operation and role, runtime vs type parity: i18n, create-only, computed, technical `editable: admin`, `editable: false`, scope. */
export const writableModesEntity = defineEntity({
  name: 'WritableParityProbe',
  collection: 'writable_parity_probe',
  scope: { field: 'companyId', provider: 'company' },
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'user', validation: { required: true }, i18n: true },
    sku: { name: 'sku', label: 'SKU', type: 'text', visibility: 'admin', editable: 'create-only' },
    total: { name: 'total', label: 'Total', type: 'number', visibility: 'user', editable: 'computed' },
    audit: { name: 'audit', label: 'Audit', type: 'text', visibility: 'technical', editable: 'admin' },
    paidAt: { name: 'paidAt', label: 'Paid at', type: 'timestamp', visibility: 'admin', editable: false },
  },
});

/** Initial values per field type (pattern text, textarea, email, tel, switch, number). */
export const initialValuesEntity = defineEntity({
  name: 'InitialValuesProbe',
  collection: 'initial_values_probe',
  fields: {
    vatNumber: { name: 'vatNumber', label: 'vat', type: 'text', visibility: 'user', validation: { pattern: '^[A-Z]{2}[A-Z0-9]{2,13}$' } },
    notes: { name: 'notes', label: 'notes', type: 'textarea', visibility: 'user' },
    email: { name: 'email', label: 'email', type: 'email', visibility: 'user' },
    phone: { name: 'phone', label: 'phone', type: 'tel', visibility: 'user' },
    sameAsBilling: { name: 'sameAsBilling', label: 'same', type: 'switch', visibility: 'user' },
    quantity: { name: 'quantity', label: 'qty', type: 'number', visibility: 'user' },
  },
});

/** A snake_case field name kept as is in initial values. */
export const snakeCaseFieldEntity = defineEntity({
  name: 'SnakeProbe',
  collection: 'snake_probe',
  fields: {
    starts_on: { name: 'starts_on', label: 'starts', type: 'text', visibility: 'user' },
  },
});

/** Initial values projected onto the written fields: i18n, generated, `editable: false`, computed, admin, create-only. */
export const projectionDefaultsEntity = defineEntity({
  name: 'ProjectionProbe',
  collection: 'projection_probe',
  fields: {
    title: { name: 'title', label: 'title', type: 'text', visibility: 'guest', i18n: true },
    revision: { name: 'revision', label: 'revision', type: 'number', visibility: 'user', editable: 'generated' },
    locked: { name: 'locked', label: 'locked', type: 'text', visibility: 'user', editable: false },
    total: { name: 'total', label: 'total', type: 'number', visibility: 'user', editable: 'computed' },
    adminNote: { name: 'adminNote', label: 'note', type: 'text', visibility: 'user', editable: 'admin' },
    sku: { name: 'sku', label: 'sku', type: 'text', visibility: 'user', editable: 'create-only' },
  },
});

/** Second entity of the assignability tests: a reference back to movements. */
export const movementOfferEntity = defineEntity({
  name: 'AssignabilityOffer',
  collection: 'assignability_offers',
  fields: {
    movementId: {
      name: 'movementId',
      label: 'movementId',
      type: 'reference',
      visibility: 'user',
      validation: { required: true },
      options: { fieldSpecific: { collection: 'assignability_movements' } },
    },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'user' },
  },
});

// =============================================================================
// References (useReferenceResolver, EntityList, parents)
// =============================================================================

/** References resolved to labels (`displayField`); a reference to a collection with no entity (`suppliers`) keeps raw ids. */
export const suppliedProductEntity = defineEntity({
  name: 'Product',
  collection: 'supplied_products',
  fields: {
    brandId: {
      name: 'brandId',
      label: 'b',
      type: 'reference',
      visibility: 'guest',
      validation: { required: true, reference: 'brands' },
      options: { fieldSpecific: { displayField: 'name' } },
    },
    supplierId: {
      name: 'supplierId',
      label: 's',
      type: 'reference',
      visibility: 'guest',
      validation: { reference: 'suppliers' },
    },
  },
});

/** A custom field type with `validation.reference` is resolved like a reference. */
export const customReferenceEntity = defineEntity({
  name: 'Listing',
  collection: 'custom_reference_listings',
  fields: {
    brandRef: { name: 'brandRef', label: 'b', type: 'owner-select', visibility: 'guest', validation: { reference: 'brands' } },
  },
});

/** More referenced collections than one resolver reads (5 > 4): the resolver throws. */
export const wideReferenceEntity = defineEntity({
  name: 'Wide',
  collection: 'wide_references',
  fields: {
    aId: { name: 'aId', label: 'a', type: 'reference', visibility: 'guest', validation: { reference: 'refs_a' } },
    bId: { name: 'bId', label: 'b', type: 'reference', visibility: 'guest', validation: { reference: 'refs_b' } },
    cId: { name: 'cId', label: 'c', type: 'reference', visibility: 'guest', validation: { reference: 'refs_c' } },
    dId: { name: 'dId', label: 'd', type: 'reference', visibility: 'guest', validation: { reference: 'refs_d' } },
    eId: { name: 'eId', label: 'e', type: 'reference', visibility: 'guest', validation: { reference: 'refs_e' } },
  },
});

/** Nested lists (`EntityList parent`): child of a brand by a reference; URL prefill only for reference fields the viewer may set (`ownerId`: admins). */
export const parentReferenceEntity = defineEntity({
  name: 'Product',
  collection: 'parent_reference_items',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'admin' },
    brandId: {
      name: 'brandId',
      label: 'brandId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'brands' },
    },
    ownerId: {
      name: 'ownerId',
      label: 'ownerId',
      type: 'reference',
      visibility: 'admin',
      editable: 'admin',
      validation: { reference: 'users' },
    },
  },
});

/** A list edited in its cells (`EntityList`): `listFields`, two references shown as labels, its own namespace. */
export const listedProductEntity = defineEntity({
  name: 'Product',
  collection: 'listed_products',
  namespace: 'entity-product',
  listFields: ['name', 'brandId', 'categoryId'],
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'admin' },
    brandId: {
      name: 'brandId',
      label: 'brandId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'brands' },
    },
    categoryId: {
      name: 'categoryId',
      label: 'categoryId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'categories' },
    },
  },
});

// =============================================================================
// Client list processing (applyFilters, getSearchableFields, applySearch)
// =============================================================================

/** List rows filtered (text contains, select exact, number range) and searched on `name` only. */
export const listItemEntity = defineEntity({
  name: 'ListItem',
  collection: 'list_items',
  search: { fields: ['name'] },
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'user' },
    status: { name: 'status', label: 'status', type: 'select', visibility: 'user' },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'user' },
  },
});

/** Explicit search fields (`search.fields`). */
export const searchFieldsEntity = defineEntity({
  name: 'SearchFields',
  collection: 'search_fields',
  search: { fields: ['name', 'code'] },
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'user' },
    code: { name: 'code', label: 'code', type: 'text', visibility: 'user' },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'user' },
  },
});

/**
 * Search fields auto-detected (`search.fields: []`): text kinds searched (a custom type with
 * a string schema too); numbers, dates, references, hidden and technical fields not.
 */
export const searchAutoEntity = defineEntity({
  name: 'SearchAuto',
  collection: 'search_auto',
  search: { fields: [] },
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'user' },
    description: { name: 'description', label: 'description', type: 'textarea', visibility: 'user' },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'user' },
    releasedOn: { name: 'releasedOn', label: 'releasedOn', type: 'date', visibility: 'user' },
    secret: { name: 'secret', label: 'secret', type: 'text', visibility: 'hidden' },
    internalId: { name: 'internalId', label: 'internalId', type: 'text', visibility: 'technical' },
    district: { name: 'district', label: 'district', type: 'paris-district', visibility: 'user', validation: { schema: v.string() } },
    brandId: { name: 'brandId', label: 'brandId', type: 'reference', visibility: 'user', validation: { reference: 'brands' } },
  },
});

/** No text field to search (status hidden: `visibility: 'technical'`): search falls back to every value. */
export const numericOnlyEntity = defineEntity({
  name: 'NumericOnly',
  collection: 'numeric_rows',
  fields: {
    price: { name: 'price', label: 'price', type: 'number', visibility: 'user' },
    count: { name: 'count', label: 'count', type: 'number', visibility: 'user' },
    status: { name: 'status', label: 'status', type: 'select', visibility: 'technical' },
  },
});

/** An address searched by its `formatted_address`. */
export const addressSearchEntity = defineEntity({
  name: 'AddressSearch',
  collection: 'address_rows',
  search: { fields: ['address'] },
  fields: {
    address: { name: 'address', label: 'address', type: 'address', visibility: 'user' },
  },
});

// =============================================================================
// UI (EntityFormRenderer, EntityList)
// =============================================================================

/** Entity form rendering (`EntityFormRenderer`): one admin field, its own namespace. */
export const formProductEntity = defineEntity({
  name: 'Product',
  collection: 'form_products',
  namespace: 'entity-product',
  fields: {
    name: { name: 'name', label: 'product.name', type: 'text', visibility: 'admin' },
  },
});

/** `conditions.required` overriding a statically required field live, next to a `conditions.visible` required field. */
export const requiredFlagsEntity = defineEntity({
  name: 'RequiredFlags',
  collection: 'required_flags',
  fields: {
    toggle: { name: 'toggle', label: 'toggle', type: 'text', visibility: 'admin' },
    name: { name: 'name', label: 'name', type: 'text', visibility: 'admin', validation: { required: true, maxLength: 50 },
      conditions: { required: when('toggle').equals('yes') } },
    static: { name: 'static', label: 'static', type: 'text', visibility: 'admin', validation: { required: true },
      conditions: { visible: when('toggle').equals('yes') } },
  },
});

/** `conditions.required` overriding a statically optional field live, next to a `conditions.visible` required field. */
export const optionalFlagsEntity = defineEntity({
  name: 'RequiredFlags',
  collection: 'optional_flags',
  fields: {
    toggle: { name: 'toggle', label: 'toggle', type: 'text', visibility: 'admin' },
    name: { name: 'name', label: 'name', type: 'text', visibility: 'admin', validation: { required: false, maxLength: 50 },
      conditions: { required: when('toggle').equals('yes') } },
    static: { name: 'static', label: 'static', type: 'text', visibility: 'admin', validation: { required: true },
      conditions: { visible: when('toggle').equals('yes') } },
  },
});

/** Read-only display: `editable: false` from the stored row, computed from form state. */
export const ledgerEntity = defineEntity({
  name: 'Ledger',
  collection: 'ledgers_display_probe',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'admin' },
    code: { name: 'code', label: 'code', type: 'text', visibility: 'admin', editable: false },
    total: { name: 'total', label: 'total', type: 'number', visibility: 'admin', editable: 'computed' },
  },
});

/** Joined lists (`EntityList` parent joined to an open form): the other side of a link table, picked in the add dialog. */
export const joinedProductEntity = defineEntity({
  name: 'JoinedProduct',
  collection: 'jl_products',
  namespace: 'entity-jl-product',
  listFields: ['name'],
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'admin' },
  },
});

/** Link table (N:M with data): exactly one reference besides the parent (`orderId`): Add opens the picker dialog. */
export const joinedLineEntity = defineEntity({
  name: 'JoinedLine',
  collection: 'jl_lines',
  namespace: 'entity-jl-line',
  listFields: ['productId', 'quantity'],
  fields: {
    orderId: {
      name: 'orderId',
      label: 'orderId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'jl_orders' },
    },
    productId: {
      name: 'productId',
      label: 'productId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'jl_products' },
    },
    quantity: { name: 'quantity', label: 'quantity', type: 'number', visibility: 'admin' },
  },
});

/** Child rows that are not a link table (only the parent reference): Add appends a blank row. */
export const joinedNoteEntity = defineEntity({
  name: 'JoinedNote',
  collection: 'jl_notes',
  namespace: 'entity-jl-note',
  listFields: ['quantity'],
  fields: {
    orderId: {
      name: 'orderId',
      label: 'orderId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'jl_orders' },
    },
    quantity: { name: 'quantity', label: 'quantity', type: 'number', visibility: 'admin' },
  },
});

/** A child of the joined notes (`noteId`), for extensions of joined rows. */
export const joinedNoteOfferEntity = defineEntity({
  name: 'JoinedOffer',
  collection: 'jl_offers',
  namespace: 'entity-jl-offer',
  listFields: ['price'],
  fields: {
    noteId: {
      name: 'noteId',
      label: 'noteId',
      type: 'reference',
      visibility: 'admin',
      validation: { reference: 'jl_notes' },
    },
    price: { name: 'price', label: 'price', type: 'number', visibility: 'admin' },
  },
});

/**
 * Grid cell edits (`cellEditFor`), one field per case: text-like, number, select options,
 * reference and custom-type reference, unsupported type, `editable` false / role /
 * create-only / computed, technical with and without a role.
 */
export const cellEditEntity = defineEntity({
  name: 'CellProbe',
  collection: 'cell_edits',
  fields: {
    email: { name: 'email', label: 'email', type: 'email', visibility: 'user' },
    quantity: { name: 'quantity', label: 'quantity', type: 'number', visibility: 'user' },
    color: { name: 'color', label: 'color', type: 'select', visibility: 'user', validation: { options: [{ value: 'red', label: 'colors.red' }] } },
    brandId: { name: 'brandId', label: 'brandId', type: 'reference', visibility: 'user', validation: { reference: 'brands' } },
    brandRef: { name: 'brandRef', label: 'brandRef', type: 'owner-select', visibility: 'user', validation: { reference: 'brands' } },
    images: { name: 'images', label: 'images', type: 'images', visibility: 'user' },
    locked: { name: 'locked', label: 'locked', type: 'text', visibility: 'user', editable: false },
    adminOnly: { name: 'adminOnly', label: 'adminOnly', type: 'text', visibility: 'user', editable: 'admin' },
    createOnly: { name: 'createOnly', label: 'createOnly', type: 'text', visibility: 'user', editable: 'create-only' },
    computed: { name: 'computed', label: 'computed', type: 'text', visibility: 'user', editable: 'computed' },
    technical: { name: 'technical', label: 'technical', type: 'text', visibility: 'technical' },
    technicalAdmin: { name: 'technicalAdmin', label: 'technicalAdmin', type: 'text', visibility: 'technical', editable: 'admin' },
  },
});

// =============================================================================
// Templates (InquiryFormTemplate): a guest inquiry about a record
// =============================================================================

/** A prospect a guest creates with an inquiry (guest fields, GDPR consent). */
export const customerEntity = defineEntity({
  name: 'Customer',
  collection: 'customers',
  access: { create: 'guest' },
  fields: {
    firstName: { name: 'firstName', label: 'firstName', type: 'text', visibility: 'guest', validation: { required: true } },
    email: { name: 'email', label: 'email', type: 'email', visibility: 'guest', validation: { required: true } },
    gdprConsent: { name: 'gdprConsent', label: 'gdprConsent', type: 'gdprConsent', visibility: 'guest' },
  },
});

/** A guest's inquiry about a car, linked to its customer (`customerId`, pre-minted). */
export const inquiryEntity = defineEntity({
  name: 'Inquiry',
  collection: 'inquiries',
  access: { create: 'guest' },
  fields: {
    customerId: { name: 'customerId', label: 'customerId', type: 'reference', visibility: 'admin', validation: { reference: 'customers' } },
    message: { name: 'message', label: 'message', type: 'textarea', visibility: 'guest', validation: { required: true } },
    carId: { name: 'carId', label: 'carId', type: 'reference', visibility: 'guest', validation: { reference: 'cars' } },
  },
});

// =============================================================================
// Schemas (createSchemas, describeEntity)
// =============================================================================

/** Translated field (`i18n: true`): companion `nameI18n` in read and write schemas, each language validated like the field without required. */
export const translatedNameEntity = defineEntity({
  name: 'Product',
  collection: 'translated_products',
  listFields: ['name'],
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest', i18n: true, validation: { required: true, maxLength: 5 } },
    sku: { name: 'sku', label: 'SKU', type: 'text', visibility: 'guest' },
  },
});

/** `i18n: true` on a type that cannot be translated (number): `createSchemas` throws. */
export const untranslatableNumberEntity = defineEntity({
  name: 'Bad',
  collection: 'untranslatable_numbers',
  fields: { n: { name: 'n', label: 'N', type: 'number', visibility: 'guest', i18n: true } },
});

/** Required, update and draft rules of the schemas (CRUD rules 1, 2, 5): a required name, a formatted phone, a hidden secret, a status the user writes. */
export const contactEntity = defineEntity({
  name: 'Contact',
  collection: 'contacts',
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'user', validation: { required: true } },
    phone: { name: 'phone', label: 'Phone', type: 'tel', visibility: 'user' },
    note: { name: 'note', label: 'Note', type: 'text', visibility: 'user' },
    secret: { name: 'secret', label: 'Secret', type: 'text', visibility: 'hidden' },
    status: { name: 'status', label: 'Status', type: 'select', visibility: 'user', validation: { required: true } },
  },
});

/** One field per descriptor class (describeEntity): value kinds (built-in, schema, reference, custom), visibility levels guest to hidden and owner, editable modes, conditions, scope, i18n. */
export const fieldClassesEntity = defineEntity({
  name: 'Listing',
  collection: 'semantic_listings',
  scope: { field: 'companyId' },
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'guest', validation: { required: true }, i18n: true },
    price: { name: 'price', label: 'Price', type: 'currency', visibility: 'guest' },
    rooms: { name: 'rooms', label: 'Rooms', type: 'number', visibility: 'guest', validation: { schema: v.pipe(v.number(), v.integer()) } },
    vatNumber: { name: 'vatNumber', label: 'VAT', type: 'text', visibility: 'user', conditions: { required: when('price').exists() } },
    total: { name: 'total', label: 'Total', type: 'number', visibility: 'user', editable: 'computed' },
    revision: { name: 'revision', label: 'Revision', type: 'number', visibility: 'admin', editable: 'generated' },
    paidAt: { name: 'paidAt', label: 'Paid at', type: 'timestamp', visibility: 'admin', editable: false },
    sku: { name: 'sku', label: 'SKU', type: 'text', visibility: 'admin', editable: 'create-only' },
    margin: { name: 'margin', label: 'Margin', type: 'number', visibility: 'super', editable: 'super' },
    secret: { name: 'secret', label: 'Secret', type: 'text', visibility: 'hidden' },
    notes: { name: 'notes', label: 'Notes', type: 'textarea', visibility: 'owner' },
    owner: { name: 'owner', label: 'Owner', type: 'owner-select', visibility: 'admin', validation: { reference: 'owners' } },
    address: {
      name: 'address',
      label: 'Address',
      type: 'isousou-address',
      visibility: 'admin',
      validation: { schema: v.optional(v.object({ street: v.string() })) },
    },
    mode: { name: 'mode', label: 'Mode', type: 'switch', visibility: 'user', options: { fieldSpecific: { checkedValue: 'auto', uncheckedValue: 'manual' } } },
    when: { name: 'when', label: 'When', type: 'time', visibility: 'user' },
    day: { name: 'day', label: 'Day', type: 'date', visibility: 'user' },
  },
});

// =============================================================================
// Runtime / type parity (fieldSemantics.parity)
// =============================================================================

// Custom field types of the parity entities (an app declares its own the same way)
declare module '@donotdev/types' {
  interface CustomFieldOptionsMap {
    'parity-owner': {};
    'parity-address': {};
    'parity-district': {};
  }
}

export const parityRoomsSchema = v.pipe(v.number(), v.integer());
/** Input differs from output (string in the form, number stored) */
export const parityFloorSchema = v.pipe(v.string(), v.transform(Number));
export const parityAddressSchema = v.object({ street: v.string() });

/**
 * Runtime / type parity (describeEntity = DescribeEntity, InferEntityRow, CreateInput,
 * FormValues): every rule on one entity (access.read, scope, i18n, conditions, schemas whose
 * input differs from output, app status, every editable mode and visibility level).
 */
export const parityListingEntity = defineEntity({
  name: 'ParityListing',
  collection: 'parity_listings',
  access: { read: 'user' },
  scope: { field: 'companyId', provider: 'company' },
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'guest', validation: { required: true }, i18n: true },
    summary: { name: 'summary', label: 'Summary', type: 'textarea', visibility: 'user' },
    vatNumber: { name: 'vatNumber', label: 'VAT', type: 'text', visibility: 'user', conditions: { required: when('price').exists() } },
    price: { name: 'price', label: 'Price', type: 'currency', visibility: 'guest' },
    rooms: { name: 'rooms', label: 'Rooms', type: 'number', visibility: 'guest', validation: { required: true, schema: parityRoomsSchema } },
    floor: { name: 'floor', label: 'Floor', type: 'number', visibility: 'user', validation: { schema: parityFloorSchema } },
    birthday: { name: 'birthday', label: 'Birthday', type: 'text', visibility: 'user', validation: { schema: v.pipe(v.string(), v.isoDate()) } },
    grade: { name: 'grade', label: 'Grade', type: 'select', visibility: 'user', validation: { schema: v.nullable(v.picklist(['a', 'b'])) } },
    kind: { name: 'kind', label: 'Kind', type: 'select', visibility: 'user', validation: { required: true, options: [{ value: 'flat', label: 'Flat' }, { value: 'house', label: 'House' }] } },
    total: { name: 'total', label: 'Total', type: 'number', visibility: 'user', editable: 'computed' },
    revision: { name: 'revision', label: 'Revision', type: 'number', visibility: 'admin', editable: 'generated' },
    paidAt: { name: 'paidAt', label: 'Paid at', type: 'timestamp', visibility: 'admin', editable: false },
    sku: { name: 'sku', label: 'SKU', type: 'text', visibility: 'admin', editable: 'create-only' },
    margin: { name: 'margin', label: 'Margin', type: 'number', visibility: 'super', editable: 'super' },
    secret: { name: 'secret', label: 'Secret', type: 'text', visibility: 'hidden' },
    notes: { name: 'notes', label: 'Notes', type: 'textarea', visibility: 'owner' },
    owner: { name: 'owner', label: 'Owner', type: 'parity-owner', visibility: 'admin', validation: { reference: 'owners' } },
    address: { name: 'address', label: 'Address', type: 'parity-address', visibility: 'admin', validation: { schema: parityAddressSchema } },
    mode: { name: 'mode', label: 'Mode', type: 'switch', visibility: 'user', options: { fieldSpecific: { checkedValue: 'auto', uncheckedValue: 'manual' } } },
    createdAt: { name: 'createdAt', label: 'Created', type: 'timestamp', visibility: 'technical', editable: 'admin' },
    status: { name: 'status', label: 'Status', type: 'select', visibility: 'admin', validation: { options: [{ value: 'sold', label: 'Sold' }] } },
  },
});

/** Runtime / type parity: one optional user field per built-in type. */
export const parityAllTypesEntity = defineEntity({
  name: 'ParityAllTypes',
  collection: 'parity_all_types',
  fields: {
    f_text: { name: 'f_text', label: 'L', type: 'text', visibility: 'user' },
    f_textarea: { name: 'f_textarea', label: 'L', type: 'textarea', visibility: 'user' },
    f_richtext: { name: 'f_richtext', label: 'L', type: 'richtext', visibility: 'user' },
    f_color: { name: 'f_color', label: 'L', type: 'color', visibility: 'user' },
    f_email: { name: 'f_email', label: 'L', type: 'email', visibility: 'user' },
    f_password: { name: 'f_password', label: 'L', type: 'password', visibility: 'user' },
    f_url: { name: 'f_url', label: 'L', type: 'url', visibility: 'user' },
    f_tel: { name: 'f_tel', label: 'L', type: 'tel', visibility: 'user' },
    f_iban: { name: 'f_iban', label: 'L', type: 'iban', visibility: 'user' },
    f_number: { name: 'f_number', label: 'L', type: 'number', visibility: 'user' },
    f_currency: { name: 'f_currency', label: 'L', type: 'currency', visibility: 'user' },
    f_range: { name: 'f_range', label: 'L', type: 'range', visibility: 'user' },
    f_year: { name: 'f_year', label: 'L', type: 'year', visibility: 'user' },
    f_rating: { name: 'f_rating', label: 'L', type: 'rating', visibility: 'user' },
    f_duration: { name: 'f_duration', label: 'L', type: 'duration', visibility: 'user' },
    f_price: { name: 'f_price', label: 'L', type: 'price', visibility: 'user' },
    f_boolean: { name: 'f_boolean', label: 'L', type: 'boolean', visibility: 'user' },
    f_checkbox: { name: 'f_checkbox', label: 'L', type: 'checkbox', visibility: 'user' },
    f_switch: { name: 'f_switch', label: 'L', type: 'switch', visibility: 'user' },
    f_gdprConsent: { name: 'f_gdprConsent', label: 'L', type: 'gdprConsent', visibility: 'user' },
    f_date: { name: 'f_date', label: 'L', type: 'date', visibility: 'user' },
    f_datetime: { name: 'f_datetime', label: 'L', type: 'datetime-local', visibility: 'user' },
    f_timestamp: { name: 'f_timestamp', label: 'L', type: 'timestamp', visibility: 'user' },
    f_time: { name: 'f_time', label: 'L', type: 'time', visibility: 'user' },
    f_week: { name: 'f_week', label: 'L', type: 'week', visibility: 'user' },
    f_month: { name: 'f_month', label: 'L', type: 'month', visibility: 'user' },
    f_file: { name: 'f_file', label: 'L', type: 'file', visibility: 'user' },
    f_files: { name: 'f_files', label: 'L', type: 'files', visibility: 'user' },
    f_document: { name: 'f_document', label: 'L', type: 'document', visibility: 'user' },
    f_documents: { name: 'f_documents', label: 'L', type: 'documents', visibility: 'user' },
    f_image: { name: 'f_image', label: 'L', type: 'image', visibility: 'user' },
    f_images: { name: 'f_images', label: 'L', type: 'images', visibility: 'user' },
    f_geopoint: { name: 'f_geopoint', label: 'L', type: 'geopoint', visibility: 'user' },
    f_address: { name: 'f_address', label: 'L', type: 'address', visibility: 'user' },
    f_map: { name: 'f_map', label: 'L', type: 'map', visibility: 'user' },
    f_array: { name: 'f_array', label: 'L', type: 'array', visibility: 'user' },
    f_fieldArray: { name: 'f_fieldArray', label: 'L', type: 'field-array', visibility: 'user' },
    f_select: { name: 'f_select', label: 'L', type: 'select', visibility: 'user' },
    f_radio: { name: 'f_radio', label: 'L', type: 'radio', visibility: 'user' },
    f_combobox: { name: 'f_combobox', label: 'L', type: 'combobox', visibility: 'user' },
    f_multiselect: { name: 'f_multiselect', label: 'L', type: 'multiselect', visibility: 'user' },
    f_reference: { name: 'f_reference', label: 'L', type: 'reference', visibility: 'user' },
    f_hidden: { name: 'f_hidden', label: 'L', type: 'hidden', visibility: 'user' },
    f_avatar: { name: 'f_avatar', label: 'L', type: 'avatar', visibility: 'user' },
    f_badge: { name: 'f_badge', label: 'L', type: 'badge', visibility: 'user' },
    f_submit: { name: 'f_submit', label: 'L', type: 'submit', visibility: 'user' },
    f_reset: { name: 'f_reset', label: 'L', type: 'reset', visibility: 'user' },
  },
});

/** Runtime / type parity: a 1:1 extension of the parity listing (`FormValues` extension keys). */
export const parityOfferEntity = defineEntity({
  name: 'ParityOffer',
  collection: 'parity_offers',
  fields: {
    listingId: { name: 'listingId', label: 'Listing', type: 'reference', visibility: 'admin', validation: { required: true, reference: 'parity_listings' } },
    priceExclVat: { name: 'priceExclVat', label: 'Price', type: 'number', visibility: 'admin', validation: { required: true } },
    note: { name: 'note', label: 'Note', type: 'text', visibility: 'admin' },
  },
});

// =============================================================================
// SEO (deriveEntitySeo, llms.txt): card text, formatting, availability
// =============================================================================

/**
 * A rental card formatted like the CRUD card: select label, number with `displayKey`,
 * `displayValue` reading the record, currency subtitle; app statuses, a guest-visible
 * status (schema.org availability reads it).
 */
export const rentalEntity = defineEntity({
  name: 'Apartment',
  collection: 'rentals',
  namespace: 'entity-apartment',
  listCardFields: {
    titleSeparator: ' - ',
    title: ['kind', 'size'],
    subtitle: ['rent', 'availableOn'],
    content: ['pictures', 'notes'],
  },
  fields: {
    status: {
      name: 'status',
      label: 'status',
      type: 'select',
      visibility: 'guest',
      validation: {
        options: [
          { value: 'available', label: 'status.available' },
          { value: 'promoted', label: 'status.promoted' },
          { value: 'reserved', label: 'status.reserved' },
          { value: 'signed', label: 'status.signed' },
        ],
      },
    },
    kind: {
      name: 'kind',
      label: 'kind',
      type: 'select',
      visibility: 'guest',
      validation: {
        options: [
          { value: 'studio', label: 'kind.studio' },
          { value: 't2', label: 'kind.t2' },
        ],
      },
    },
    size: { name: 'size', label: 'size', type: 'number', visibility: 'guest', options: { displayKey: 'fields.size_display' } },
    rent: { name: 'rent', label: 'rent', type: 'currency', visibility: 'guest' },
    availableOn: {
      name: 'availableOn',
      label: 'availableOn',
      type: 'date',
      visibility: 'guest',
      options: {
        displayValue: (value: unknown, item: Record<string, unknown>, t: (key: string) => string) => {
          if (item.status === 'reserved' || item.status === 'signed') return null;
          return String(value) <= '2026-01-01' ? t('status.available_now') : String(value);
        },
      },
    },
    pictures: { name: 'pictures', label: 'pictures', type: 'images', visibility: 'guest' },
    notes: { name: 'notes', label: 'notes', type: 'text', visibility: 'guest' },
    description: { name: 'description', label: 'description', type: 'textarea', visibility: 'guest' },
  },
});

// =============================================================================
// Server stores and providers (entity store, Supabase adapter)
// =============================================================================

/** Entity names in, snake_case columns out (`createEntityStore`): a required name, a camelCase number, an `editable: false` timestamp. */
export const weightedProductEntity = defineEntity({
  name: 'Product',
  collection: 'weighted_products',
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest', validation: { required: true } },
    weightGrams: { name: 'weightGrams', label: 'Weight', type: 'number', visibility: 'guest' },
    brandId: { name: 'brandId', label: 'Brand', type: 'text', visibility: 'guest' },
    paidAt: { name: 'paidAt', label: 'Paid at', type: 'timestamp', visibility: 'admin', editable: false },
  },
});

/** Postgres CHECK violations mapped back to the field (`<table>_<column>_<rule>`): one optional camelCase number. */
export const weightCheckEntity = defineEntity({
  name: 'Product',
  collection: 'weight_checks',
  fields: {
    weightGrams: { name: 'weightGrams', label: 'Weight', type: 'number', visibility: 'guest' },
  },
});

/** A translated column whose companion (`description_i18n`) the table may not have yet: reads retry without it. */
export const translatedDescriptionEntity = defineEntity({
  name: 'Product',
  collection: 'translated_descriptions',
  fields: {
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'guest' },
    description: {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      visibility: 'guest',
      i18n: true,
    },
  },
});

// =============================================================================
// Payload generation and CRUD flows (@donotdev/testing)
// =============================================================================

/** The role a write uses (`access.update`): one field it edits, one only a super admin edits (`editable: super`). */
export const superOnlyFieldEntity = defineEntity({
  name: 'Note',
  collection: 'super_notes',
  fields: {
    superOnly: { name: 'superOnly', label: 'Super only', type: 'text', visibility: 'admin', editable: 'super' },
    title: { name: 'title', label: 'Title', type: 'text', visibility: 'guest', validation: { required: true } },
  },
  access: { create: 'admin', read: 'guest', update: 'admin', delete: 'admin' },
});

/** Generated payloads: write classes decide the keys (user, derived, program in; never, files out), kinds and schemas the values. */
export const payloadEntity = defineEntity({
  name: 'Product',
  collection: 'payload_products',
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest', validation: { required: true, maxLength: 12 } },
    email: { name: 'email', label: 'Email', type: 'email', visibility: 'guest' },
    phone: { name: 'phone', label: 'Phone', type: 'tel', visibility: 'guest' },
    kind: { name: 'kind', label: 'Kind', type: 'select', visibility: 'guest', validation: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } },
    qty: { name: 'qty', label: 'Qty', type: 'number', visibility: 'guest', validation: { min: 5, max: 9, schema: v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(9)) } },
    price: { name: 'price', label: 'Price', type: 'price', visibility: 'guest' },
    address: { name: 'address', label: 'Address', type: 'address', visibility: 'guest' },
    opensAt: { name: 'opensAt', label: 'Opens', type: 'time', visibility: 'guest' },
    week: { name: 'week', label: 'Week', type: 'week', visibility: 'guest' },
    total: { name: 'total', label: 'Total', type: 'number', visibility: 'guest', editable: 'computed' },
    paidAt: { name: 'paidAt', label: 'Paid', type: 'timestamp', visibility: 'admin', editable: false },
    revision: { name: 'revision', label: 'Rev', type: 'number', visibility: 'admin', editable: 'generated' },
    secret: { name: 'secret', label: 'Secret', type: 'text', visibility: 'hidden' },
    photo: { name: 'photo', label: 'Photo', type: 'image', visibility: 'guest' },
    brandId: { name: 'brandId', label: 'Brand', type: 'reference', visibility: 'guest', validation: { reference: 'brands' } },
  },
});

/** Built-in types a payload sample exists for (no reference, no button). */
const SAMPLE_TYPES = FIELD_TYPES.filter((type) => !['reference', 'submit', 'reset'].includes(type));

/** Payload samples per kind: one optional guest field per built-in type (`field-array` → `fieldArray`). */
export const sampleTypesEntity = defineEntity({
  name: 'SampleTypes',
  collection: 'sample_types',
  fields: Object.fromEntries(
    SAMPLE_TYPES.map((type) => {
      const name = type.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
      return [name, { name, label: name, type, visibility: 'guest' }];
    })
  ) as Record<string, { name: string; label: string; type: (typeof FIELD_TYPES)[number]; visibility: 'guest' }>,
});

/** A required reference: no sample, the id comes from overrides. */
export const requiredReferenceEntity = defineEntity({
  name: 'Order',
  collection: 'required_references',
  fields: {
    productId: { name: 'productId', label: 'Product', type: 'reference', visibility: 'guest', validation: { required: true, reference: 'products' } },
  },
});

/** A pattern no sample satisfies: generation throws, naming entity.field. */
export const unsatisfiablePatternEntity = defineEntity({
  name: 'Odd',
  collection: 'odd_patterns',
  fields: {
    code: { name: 'code', label: 'Code', type: 'text', visibility: 'guest', validation: { pattern: '^ZZ[0-9]{9}$' } },
  },
});

// =============================================================================
// SQL and seeds (tooling generators)
// =============================================================================

/** Postgres CHECK constraints from the descriptor (`<table>_<column>_<rule>`): required, length, pattern, tel, options, multiselect, range, integer schema, json kinds; email and schema internals have no SQL twin. */
export const checkedProductEntity = defineEntity({
  name: 'Product',
  collection: 'checked_products',
  fields: {
    name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest', validation: { required: true, minLength: 2, maxLength: 80 } },
    sku: { name: 'sku', label: 'SKU', type: 'text', visibility: 'guest', validation: { pattern: '^[A-Z]{3}-\\d+$' } },
    phone: { name: 'phone', label: 'Phone', type: 'tel', visibility: 'guest' },
    email: { name: 'email', label: 'Email', type: 'email', visibility: 'guest', validation: { required: true } },
    kind: { name: 'kind', label: 'Kind', type: 'select', visibility: 'guest', validation: { options: [{ value: 'a', label: 'A' }, { value: "b'c", label: 'B' }] } },
    tags: { name: 'tags', label: 'Tags', type: 'multiselect', visibility: 'guest', validation: { options: [{ value: 'x', label: 'X' }] } },
    weight: { name: 'weight', label: 'Weight', type: 'number', visibility: 'guest', validation: { min: 0, max: 500 } },
    rooms: { name: 'rooms', label: 'Rooms', type: 'number', visibility: 'guest', validation: { schema: v.pipe(v.number(), v.integer(), v.minValue(1)), min: 1 } },
    price: { name: 'price', label: 'Price', type: 'price', visibility: 'guest', validation: { required: true } },
    photo: { name: 'photo', label: 'Photo', type: 'image', visibility: 'guest' },
    meta: { name: 'meta', label: 'Meta', type: 'map', visibility: 'guest' },
    lines: { name: 'lines', label: 'Lines', type: 'field-array', visibility: 'guest' },
    custom: { name: 'custom', label: 'Custom', type: 'text', visibility: 'guest', validation: { schema: v.pipe(v.string(), v.minLength(9)) } },
  },
});

/** A pattern with a named group (no SQL twin): CHECK generation throws, naming entity.field. */
export const namedGroupPatternEntity = defineEntity({
  name: 'Bad',
  collection: 'named_group_patterns',
  fields: { code: { name: 'code', label: 'Code', type: 'text', visibility: 'guest', validation: { pattern: '(?<y>\\d)' } } },
});

/** SQL column types from the descriptor kind: ref → uuid, json kinds → jsonb, integer schema → integer, week text, time. */
export const sqlColumnKindsEntity = defineEntity({
  name: 'Listing',
  collection: 'sql_column_kinds',
  fields: {
    ownerRef: { name: 'ownerRef', label: 'Owner', type: 'owner-select' as never, visibility: 'admin', validation: { reference: 'owners' } },
    photo: { name: 'photo', label: 'Photo', type: 'image', visibility: 'guest' },
    tags: { name: 'tags', label: 'Tags', type: 'multiselect', visibility: 'guest', validation: { options: [{ value: 'a', label: 'A' }] } },
    rooms: { name: 'rooms', label: 'Rooms', type: 'number', visibility: 'guest', validation: { schema: v.pipe(v.number(), v.integer()) } },
    week: { name: 'week', label: 'Week', type: 'week', visibility: 'guest' },
    opensAt: { name: 'opensAt', label: 'Opens', type: 'time', visibility: 'guest' },
  },
});
