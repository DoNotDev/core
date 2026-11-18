/**
 * Parity: runtime descriptor (`describeEntity`) = type twin (`DescribeEntity`).
 *
 * Design doc §6 items 1, 2, 3, 4, 7 (docs/plans/2026-11-17-entity-derived-types-design.html):
 * 1. Descriptor parity: one literal EXPECTED per fixture, checked against both layers
 *    (facts, name, collection, editableFor per role and operation).
 * 2. Value parity: corpus per built-in type; the runtime verdict matches the type.
 * 3. Key-set parity: FIELD_TYPES = keys of BUILTIN_VALUES = FieldTypeToValue = FieldTypeToKind
 *    (formatter registry: features/crud registerBuiltinFieldTypes.keyset.test.ts).
 * 4. Operation round-trip: payloads per operation / status pass the `writeSchemaFor`
 *    schema and typecheck as CreateInput / DraftInput / UpdatePatch; removing a
 *    required value fails both.
 * 7. Fail loud: custom type without value shape, or with a schema whose kind cannot
 *    be read → throw and type error.
 *
 * Type assertions (`expectTypeOf`, `@ts-expect-error`) are compile-time only: `dn tc`
 * excludes `__tests__`, so check them by typechecking a copy of this file inside `src`.
 */
import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  FIELD_TYPES,
  type BuiltInFieldType,
  type CreateInput,
  type DescribeEntity,
  type DraftInput,
  type EditableForOf,
  type EntityField,
  type FieldInputOf,
  type FieldKindOf,
  type FieldTypeToKind,
  type FieldTypeToValue,
  type FieldValueOf,
  type FormValues,
  type InferEntityRow,
  type RequireValueShapes,
  type UpdatePatch,
} from '@donotdev/types';
import { when } from '@donotdev/utils/server';

import { createSchemas } from '../createSchema';
import { defineEntity } from '../defineEntity';
import {
  BUILTIN_VALUES,
  describeEntity,
  resolveFieldValue,
  type EntityDescriptor,
} from '../fieldSemantics';
import { writeSchemaFor, type WriteOperation } from '../crud/status';
import { parityAddressSchema, parityAllTypesEntity as allTypes, parityListingEntity as listing, parityOfferEntity, parityRoomsSchema } from '@dndev/test-entities';


// ============================================================================
// Projection shared by both layers: the descriptor's facts (schema identity and
// editableFor are checked separately: a schema object and a closure are not literals)
// ============================================================================

type Simplify<T> = { [K in keyof T]: T[K] } & unknown;

type FieldFacts<D> = D extends {
  readonly value: infer Val;
  readonly required: infer Req;
  readonly write: infer W;
  readonly visibleAt: infer Vis;
}
  ? Simplify<
      {
        readonly kind: Val extends { readonly kind: infer K } ? K : never;
        readonly required: Req;
        readonly write: W;
        readonly visibleAt: Vis;
      } & (Val extends { readonly ref: infer R } ? { readonly ref: R } : unknown) &
        (D extends { readonly companion: infer C }
          ? { readonly companion: C }
          : unknown)
    >
  : never;

type Facts<D extends { readonly fields: object }> = {
  readonly [K in keyof D['fields']]: FieldFacts<D['fields'][K]>;
};

function facts(descriptor: EntityDescriptor): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(descriptor.fields).map(([name, field]) => [
      name,
      {
        kind: field.value.kind,
        required: field.required,
        write: field.write,
        visibleAt: field.visibleAt,
        ...(field.value.ref !== undefined && { ref: field.value.ref }),
        ...(field.companion !== undefined && { companion: field.companion }),
      },
    ])
  );
}

// ============================================================================
// Fixture 1: every rule
// ============================================================================


const LISTING = {
  title: { kind: 'text', required: 'always', write: 'user', visibleAt: 'guest', companion: 'titleI18n' },
  summary: { kind: 'text', required: 'never', write: 'user', visibleAt: 'user' },
  vatNumber: { kind: 'text', required: 'conditional', write: 'user', visibleAt: 'user' },
  price: { kind: 'number', required: 'never', write: 'user', visibleAt: 'guest' },
  rooms: { kind: 'integer', required: 'always', write: 'user', visibleAt: 'guest' },
  floor: { kind: 'number', required: 'never', write: 'user', visibleAt: 'user' },
  birthday: { kind: 'date', required: 'never', write: 'user', visibleAt: 'user' },
  grade: { kind: 'text', required: 'never', write: 'user', visibleAt: 'user' },
  kind: { kind: 'text', required: 'always', write: 'user', visibleAt: 'user' },
  total: { kind: 'number', required: 'never', write: 'derived', visibleAt: 'user' },
  revision: { kind: 'number', required: 'never', write: 'never', visibleAt: 'admin' },
  paidAt: { kind: 'timestamp', required: 'never', write: 'program', visibleAt: 'admin' },
  sku: { kind: 'text', required: 'never', write: 'user', visibleAt: 'admin' },
  margin: { kind: 'number', required: 'never', write: 'user', visibleAt: 'super' },
  secret: { kind: 'text', required: 'never', write: 'never', visibleAt: 'hidden' },
  notes: { kind: 'text', required: 'never', write: 'user', visibleAt: 'owner' },
  owner: { kind: 'ref', required: 'never', write: 'user', visibleAt: 'admin', ref: 'owners' },
  address: { kind: 'json', required: 'never', write: 'user', visibleAt: 'admin' },
  mode: { kind: 'text', required: 'never', write: 'user', visibleAt: 'user' },
  status: { kind: 'text', required: 'always', write: 'user', visibleAt: 'admin' },
  id: { kind: 'text', required: 'always', write: 'never', visibleAt: 'hidden' },
  createdAt: { kind: 'timestamp', required: 'never', write: 'never', visibleAt: 'technical' },
  updatedAt: { kind: 'timestamp', required: 'never', write: 'never', visibleAt: 'technical' },
  createdById: { kind: 'ref', required: 'never', write: 'never', visibleAt: 'technical' },
  updatedById: { kind: 'ref', required: 'never', write: 'never', visibleAt: 'technical' },
  companyId: { kind: 'ref', required: 'always', write: 'user', visibleAt: 'technical', ref: 'companies' },
} as const;

// ============================================================================
// Fixture 2: one field per built-in type (no options, optional, user)
// ============================================================================


const user = <K extends string>(kind: K) =>
  ({ kind, required: 'never', write: 'user', visibleAt: 'user' }) as const;

const ALL_TYPES = {
  f_text: user('text'),
  f_textarea: user('text'),
  f_richtext: user('text'),
  f_color: user('text'),
  f_email: user('text'),
  f_password: user('text'),
  f_url: user('text'),
  f_tel: user('text'),
  f_iban: user('text'),
  f_number: user('number'),
  f_currency: user('number'),
  f_range: user('number'),
  f_year: user('number'),
  f_rating: user('number'),
  f_duration: user('number'),
  f_price: user('json'),
  f_boolean: user('boolean'),
  f_checkbox: user('boolean'),
  f_switch: user('boolean'),
  f_gdprConsent: user('json'),
  f_date: user('date'),
  f_datetime: user('timestamp'),
  f_timestamp: user('timestamp'),
  f_time: user('time'),
  f_week: user('text'),
  f_month: user('text'),
  f_file: user('json'),
  f_files: user('json'),
  f_document: user('json'),
  f_documents: user('json'),
  f_image: user('json'),
  f_images: user('json'),
  f_geopoint: user('json'),
  f_address: user('json'),
  f_map: user('json'),
  f_array: user('json'),
  f_fieldArray: user('json'),
  f_select: user('text'),
  f_radio: user('text'),
  f_combobox: user('text'),
  f_multiselect: user('json'),
  f_reference: user('ref'),
  f_hidden: user('text'),
  f_avatar: user('text'),
  f_badge: user('text'),
  f_submit: user('text'),
  f_reset: user('text'),
  status: { kind: 'text', required: 'always', write: 'user', visibleAt: 'admin' },
  id: { kind: 'text', required: 'always', write: 'never', visibleAt: 'hidden' },
  createdAt: { kind: 'timestamp', required: 'never', write: 'never', visibleAt: 'technical' },
  updatedAt: { kind: 'timestamp', required: 'never', write: 'never', visibleAt: 'technical' },
  createdById: { kind: 'ref', required: 'never', write: 'never', visibleAt: 'technical' },
  updatedById: { kind: 'ref', required: 'never', write: 'never', visibleAt: 'technical' },
} as const;

// ============================================================================
// editableFor table of fixture 1 (role × operation)
// ============================================================================

const ROLES = ['guest', 'user', 'admin', 'super'] as const;
type Role = (typeof ROLES)[number];
const ALL = ROLES;
const NONE = [] as const;
const SUPER = ['super'] as const;

/** Fields every role edits on both operations */
const OPEN = { title: ALL, summary: ALL, vatNumber: ALL, price: ALL, rooms: ALL, floor: ALL, birthday: ALL, grade: ALL, kind: ALL, notes: ALL, owner: ALL, address: ALL, mode: ALL } as const;
/** Base status field: `editable: 'admin'` */
const ADMIN = ['admin', 'super'] as const;
/** Fields nobody edits as an input (write class not `user`, or technical) */
const CLOSED = { total: NONE, revision: NONE, paidAt: NONE, secret: NONE, id: NONE, createdAt: NONE, updatedAt: NONE, createdById: NONE, updatedById: NONE } as const;

const EDITABLE_CREATE = { ...OPEN, ...CLOSED, status: ADMIN, sku: ALL, margin: SUPER, companyId: ALL } as const;
const EDITABLE_EDIT = { ...OPEN, ...CLOSED, status: ADMIN, sku: NONE, margin: SUPER, companyId: NONE } as const;

/** `{ field: roles[] }` → `{ field: role union }` (`never`: no role) */
type ToRoleUnions<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer R)[] ? R : never };

/** Type twin of the table: per field, the roles `EditableForOf` admits */
type EditableTable<E extends { fields: object }, Op extends 'create' | 'edit'> = Simplify<{
  [K in keyof E['fields']]: { [R in Role]: EditableForOf<K, E['fields'][K], R, Op> extends true ? R : never }[Role];
}>;

// ============================================================================
// 1. Descriptor parity
// ============================================================================

describe('descriptor parity: describeEntity = DescribeEntity', () => {
  it('fixture with every rule', () => {
    expect(facts(describeEntity(listing))).toEqual(LISTING);
    expectTypeOf<Facts<DescribeEntity<typeof listing>>>().toEqualTypeOf<typeof LISTING>();
  });

  it('one field per built-in type', () => {
    expect(facts(describeEntity(allTypes))).toEqual(ALL_TYPES);
    expectTypeOf<Facts<DescribeEntity<typeof allTypes>>>().toEqualTypeOf<typeof ALL_TYPES>();
  });

  it('name and collection', () => {
    const descriptor = describeEntity(listing);
    expect([descriptor.name, descriptor.collection]).toEqual([listing.name, listing.collection]);
    expectTypeOf<DescribeEntity<typeof listing>['name']>().toEqualTypeOf<(typeof listing)['name']>();
    expectTypeOf<DescribeEntity<typeof listing>['collection']>().toEqualTypeOf<(typeof listing)['collection']>();
  });

  it('editableFor: per role and operation', () => {
    const { fields } = describeEntity(listing);
    const table = (op: 'create' | 'edit') =>
      Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [name, ROLES.filter((role) => field.editableFor(role, op))])
      );
    expect(table('create')).toEqual(EDITABLE_CREATE);
    expect(table('edit')).toEqual(EDITABLE_EDIT);
    expectTypeOf<EditableTable<typeof listing, 'create'>>().toEqualTypeOf<Simplify<ToRoleUnions<typeof EDITABLE_CREATE>>>();
    expectTypeOf<EditableTable<typeof listing, 'edit'>>().toEqualTypeOf<Simplify<ToRoleUnions<typeof EDITABLE_EDIT>>>();
  });

  it('validation.schema is the value schema in both layers', () => {
    const { fields } = describeEntity(listing);
    expect(fields.rooms?.value.schema).toBe(parityRoomsSchema);
    expect(fields.address?.value.schema).toBe(parityAddressSchema);
    type D = DescribeEntity<typeof listing>['fields'];
    expectTypeOf<D['rooms']['value']['schema']>().toEqualTypeOf<typeof parityRoomsSchema>();
    expectTypeOf<D['address']['value']['schema']>().toEqualTypeOf<typeof parityAddressSchema>();
  });

  it('literal entity: merged status options, scope field, access', () => {
    expect(listing.fields.status.validation.options.map((o) => o.value)).toEqual(['draft', 'available', 'deleted', 'sold']);
    expectTypeOf<FieldValueOf<(typeof listing)['fields']['status']>>().toEqualTypeOf<'draft' | 'available' | 'deleted' | 'sold'>();
    expect(listing.fields.companyId.validation.reference).toBe('companies');
    expectTypeOf(listing.fields.companyId.validation.reference).toEqualTypeOf<'companies'>();
    expect(listing.access.read).toBe('user');
    expectTypeOf(listing.access).toEqualTypeOf<{ create: 'admin'; read: 'user'; update: 'admin'; delete: 'admin' }>();
  });
});

// ============================================================================
// Types per operation (doc §3.3 / §3.5), from the same fixture
// ============================================================================

/** Declared keys of a row (the `Record<string, unknown>` index signature left out) */
type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : K]: T[K] };

type Row = InferEntityRow<typeof listing>;
type Published = Extract<Row, { status?: 'available' | 'sold' }>;
type Relaxed = Extract<Row, { status?: 'draft' | 'deleted' }>;

describe('InferEntityRow: union on status', () => {
  it('published rows: required → V, optional / conditional → V | null', () => {
    expectTypeOf<Published['title']>().toEqualTypeOf<string>();
    expectTypeOf<Published['rooms']>().toEqualTypeOf<number>();
    expectTypeOf<Published['kind']>().toEqualTypeOf<'flat' | 'house'>();
    expectTypeOf<Published['summary']>().toEqualTypeOf<string | null>();
    expectTypeOf<Published['vatNumber']>().toEqualTypeOf<string | null>();
    expectTypeOf<Published['mode']>().toEqualTypeOf<'auto' | 'manual' | null>();
    expectTypeOf<Published['address']>().toEqualTypeOf<{ street: string } | null | undefined>();
  });

  it('draft and deleted rows: every field V | null', () => {
    expectTypeOf<Relaxed['title']>().toEqualTypeOf<string | null>();
    expectTypeOf<Relaxed['rooms']>().toEqualTypeOf<number | null>();
  });

  it('keys above access.read are optional; hidden fields are left out', () => {
    expectTypeOf<Published['status']>().toEqualTypeOf<'available' | 'sold' | undefined>();
    expectTypeOf<Published['createdById']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Published['companyId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Published['notes']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Published['id']>().toEqualTypeOf<string>();
    expectTypeOf<'secret' extends KnownKeys<Published> ? true : false>().toEqualTypeOf<false>();
  });
});

describe('CreateInput / DraftInput / UpdatePatch', () => {
  type Create = CreateInput<typeof listing>;
  type Draft = DraftInput<typeof listing>;
  type Patch = UpdatePatch<typeof listing>;

  it('write classes user, derived, program; never left out', () => {
    expectTypeOf<keyof Create>().toEqualTypeOf<
      | 'title' | 'titleI18n' | 'summary' | 'vatNumber' | 'price' | 'rooms' | 'floor' | 'birthday' | 'grade' | 'kind'
      | 'total' | 'paidAt' | 'sku' | 'margin' | 'notes' | 'owner' | 'address' | 'mode' | 'status' | 'companyId'
    >();
    expectTypeOf<keyof Patch>().toEqualTypeOf<keyof Create>();
  });

  it('create: required key and value, optional V | null', () => {
    expectTypeOf<Create['title']>().toEqualTypeOf<string>();
    expectTypeOf<Create['status']>().toEqualTypeOf<'draft' | 'available' | 'deleted' | 'sold'>();
    expectTypeOf<Create['companyId']>().toEqualTypeOf<string>();
    expectTypeOf<Create['summary']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Create['floor']>().toEqualTypeOf<number | null | undefined>();
  });

  it('draft: status draft, every other field optional V | null', () => {
    expectTypeOf<Draft['status']>().toEqualTypeOf<'draft'>();
    expectTypeOf<Draft['title']>().toEqualTypeOf<string | null | undefined>();
  });

  it('update: a required field sent is filled (no null)', () => {
    expectTypeOf<Patch['title']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Patch['summary']>().toEqualTypeOf<string | null | undefined>();
  });
});

describe('FormValues', () => {
  type CreateForm = Extract<FormValues<typeof listing, 'create'>, { status?: 'available' | 'deleted' | 'sold' }>;
  type EditForm = FormValues<typeof listing, 'edit'>;

  it('form input type for schema fields, written fields only', () => {
    expectTypeOf<CreateForm['floor']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<FieldInputOf<(typeof listing)['fields']['floor']>>().toEqualTypeOf<string>();
    expectTypeOf<CreateForm['title']>().toEqualTypeOf<string>();
    expectTypeOf<CreateForm['total']>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<'paidAt' extends keyof CreateForm ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'sku' extends keyof CreateForm ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<'sku' extends keyof EditForm ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<EditForm['id']>().toEqualTypeOf<string>();
  });

  it('scope field: not in form state (injectScope adds it), unlike CreateInput', () => {
    expectTypeOf<'companyId' extends keyof CreateForm ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'companyId' extends keyof EditForm ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'companyId' extends keyof CreateInput<typeof listing> ? true : false>().toEqualTypeOf<true>();
  });

  it('extension keys: each 1:1 extension under its key, without link field and status', () => {
    const offer = parityOfferEntity;
    type Extended = FormValues<typeof listing, 'edit', { offer: { entity: typeof offer; field: 'listingId' } }>;
    type Offer = NonNullable<Extended['offer']>;
    expectTypeOf<undefined extends Extended['offer'] ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<'listingId' | 'status' extends keyof Offer ? true : false>().toEqualTypeOf<false>();
    // Updated when the row exists (with its id), else inserted
    expectTypeOf<Extract<Offer, { id: string }>['priceExclVat']>().toEqualTypeOf<number>();
    expectTypeOf<Exclude<Offer, { id: string }>['priceExclVat']>().toEqualTypeOf<number>();
    expectTypeOf<Exclude<Offer, { id: string }>['note']>().toEqualTypeOf<string | null | undefined>();
    // Without extensions: no extra key
    expectTypeOf<'offer' extends keyof EditForm ? true : false>().toEqualTypeOf<false>();
  });
});

// ============================================================================
// 4. Operation round-trip: payload per operation / status → writeSchemaFor schema
// ============================================================================

const listingSchemas = createSchemas(listing);

/** Runtime verdict of a payload with the schema the one status rule picks */
function passes(op: WriteOperation, payload: Record<string, unknown>, storedStatus?: string): boolean {
  const status = typeof payload.status === 'string' ? payload.status : null;
  const key = writeSchemaFor({ op, status, storedStatus });
  return v.safeParse(listingSchemas[key], op === 'update' ? { ...payload, id: 'l1' } : payload).success;
}

/** Written fields of the descriptor that a create must carry */
function requiredOnCreate(): string[] {
  return Object.entries(describeEntity(listing).fields)
    .filter(([, field]) => field.write !== 'never' && field.required === 'always')
    .map(([name]) => name)
    .sort();
}

describe('operation round-trip: runtime schema = CreateInput / DraftInput / UpdatePatch', () => {
  const create = {
    title: 'Flat', rooms: 3, kind: 'flat', status: 'available', companyId: 'c1',
    summary: null, owner: 'o1', address: { street: '1 rue X' }, mode: 'auto',
  } satisfies CreateInput<typeof listing>;

  it('create: the descriptor required fields, in both layers', () => {
    expect(Object.keys(create).filter((name) => requiredOnCreate().includes(name)).sort()).toEqual(requiredOnCreate());
    expect(passes('create', create)).toBe(true);
  });

  it('create: removing a required value fails both', () => {
    const { title: _title, ...withoutTitle } = create;
    // @ts-expect-error title is required on create
    withoutTitle satisfies CreateInput<typeof listing>;
    expect(passes('create', withoutTitle)).toBe(false);
    // @ts-expect-error a required field is not null on create
    ({ ...create, rooms: null }) satisfies CreateInput<typeof listing>;
    expect(passes('create', { ...create, rooms: null })).toBe(false);
  });

  it('draft: required fields may be empty, filled values keep their format', () => {
    const draft = { status: 'draft', title: null, companyId: 'c1' } satisfies DraftInput<typeof listing>;
    expect(passes('create', draft)).toBe(true);
    // @ts-expect-error a filled value keeps its type in a draft
    ({ ...draft, rooms: 'three' }) satisfies DraftInput<typeof listing>;
    expect(passes('create', { ...draft, rooms: 'three' })).toBe(false);
    // Without its draft status the payload is a create: its required values are missing
    const { status: _status, ...withoutStatus } = draft;
    // @ts-expect-error a draft payload carries status 'draft'
    withoutStatus satisfies DraftInput<typeof listing>;
    expect(passes('create', withoutStatus)).toBe(false);
  });

  it('update: a patch sends filled required values; a draft is written as a draft', () => {
    const patch = { title: 'Renamed', summary: null } satisfies UpdatePatch<typeof listing>;
    expect(passes('update', patch, 'available')).toBe(true);
    // @ts-expect-error a required field sent in an update is filled in
    ({ title: null }) satisfies UpdatePatch<typeof listing>;
    expect(passes('update', { title: null }, 'available')).toBe(false);
    // The resulting status is draft: the draft schema, required values may be empty
    const draftPatch = { status: 'draft', title: null } satisfies DraftInput<typeof listing>;
    expect(passes('update', draftPatch, 'available')).toBe(true);
  });
});

// ============================================================================
// 2. Value parity per built-in type
// ============================================================================

/** Literal field (const), as `defineEntity` keeps it */
const def = <const F extends EntityField>(field: F): F => field;

/** Type-level value of a field: an argument that is not a value is a type error */
const valueOf = <F,>(value: FieldValueOf<F>): unknown => value;

/** Runtime accepts each value, and each is a value of the type */
function accepts<const F extends EntityField>(field: F, ...values: NoInfer<FieldValueOf<F>>[]): void {
  const { schema } = resolveFieldValue(field);
  for (const value of values) expect(v.is(schema, value), `${field.type} ${JSON.stringify(value)}`).toBe(true);
}

/** Runtime rejects each value (type-level rejection: `@ts-expect-error` next to the call) */
function rejects(field: EntityField, ...values: unknown[]): void {
  const { schema } = resolveFieldValue(field);
  for (const value of values) expect(v.is(schema, value), `${field.type} ${JSON.stringify(value)}`).toBe(false);
}

const ASSET = { url: 'https://x.io/a.pdf', filename: 'a.pdf', size: 1 };
const PICTURE = { fullUrl: 'https://x.io/a.png', thumbUrl: 'https://x.io/t.png' };

describe('value parity per built-in type', () => {
  it('text-like', () => {
    for (const type of ['text', 'textarea', 'richtext', 'color', 'password', 'hidden', 'avatar', 'badge'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, 'a', '');
      rejects(field, 1, null);
    }
    const text = def({ name: 'f', label: 'L', type: 'text', visibility: 'user' });
    // @ts-expect-error a number is not a text value
    valueOf<typeof text>(1);
    // @ts-expect-error null is not a value (presence is applied per operation)
    valueOf<typeof text>(null);

    const email = def({ name: 'f', label: 'L', type: 'email', visibility: 'user' });
    accepts(email, 'a@b.co');
    rejects(email, 'nope', 1);
    const url = def({ name: 'f', label: 'L', type: 'url', visibility: 'user' });
    accepts(url, 'https://x.io');
    rejects(url, 'nope', 1);
    const tel = def({ name: 'f', label: 'L', type: 'tel', visibility: 'user' });
    accepts(tel, '+33 6 12 34 56 78', '0612345678');
    rejects(tel, '12', 1);
    const iban = def({ name: 'f', label: 'L', type: 'iban', visibility: 'user' });
    accepts(iban, 'FR7630006000011234567890189');
    rejects(iban, 'XX', 1);
  });

  it('numeric', () => {
    for (const type of ['number', 'currency', 'range', 'year', 'rating', 'duration'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, 0, 1.5);
      rejects(field, '1');
    }
    const currency = def({ name: 'f', label: 'L', type: 'currency', visibility: 'user' });
    // @ts-expect-error a string is not a currency value
    valueOf<typeof currency>('1');

    const price = def({ name: 'f', label: 'L', type: 'price', visibility: 'user' });
    accepts(price, { amount: 10 }, { amount: 1, currency: 'EUR', vatIncluded: true, discountPercent: 50 });
    rejects(price, { amount: 1, discountPercent: 150 }, { currency: 'EUR' });
    // @ts-expect-error a price has an amount
    valueOf<typeof price>({ currency: 'EUR' });
  });

  it('boolean, switch, gdprConsent', () => {
    for (const type of ['boolean', 'checkbox', 'switch'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, true, false);
      rejects(field, 'true');
    }
    const checkbox = def({ name: 'f', label: 'L', type: 'checkbox', visibility: 'user' });
    // @ts-expect-error a string is not a boolean value
    valueOf<typeof checkbox>('true');

    const stringSwitch = def({ name: 'f', label: 'L', type: 'switch', visibility: 'user', options: { fieldSpecific: { checkedValue: 'auto', uncheckedValue: 'manual' } } });
    accepts(stringSwitch, 'auto', 'manual');
    rejects(stringSwitch, true, 'x');
    // @ts-expect-error a string switch stores one of its two strings
    valueOf<typeof stringSwitch>(true);

    const consent = def({ name: 'f', label: 'L', type: 'gdprConsent', visibility: 'user' });
    accepts(consent, false, { gdprConsent: true }, { gdprConsent: true, gdprConsentDate: '2026-11-17' });
    rejects(consent, true, { gdprConsent: false });
    // @ts-expect-error consent is false or the consent object
    valueOf<typeof consent>(true);
    const requiredConsent = def({ name: 'f', label: 'L', type: 'gdprConsent', visibility: 'user', validation: { required: true } });
    accepts(requiredConsent, { gdprConsent: true });
    rejects(requiredConsent, false);
    // @ts-expect-error a required consent is given
    valueOf<typeof requiredConsent>(false);
  });

  it('date and time', () => {
    for (const type of ['date', 'datetime-local', 'timestamp'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, '2024-03-15', '2024-03-15T00:00:00.000Z');
      rejects(field, 'nope', 1);
    }
    const time = def({ name: 'f', label: 'L', type: 'time', visibility: 'user' });
    accepts(time, '10:30', '10:30:15');
    rejects(time, '25:00', '2024-03-15', 1);
    const week = def({ name: 'f', label: 'L', type: 'week', visibility: 'user' });
    accepts(week, '2026-W47');
    rejects(week, '2026-W54', 1);
    const month = def({ name: 'f', label: 'L', type: 'month', visibility: 'user' });
    accepts(month, '2026-11');
    rejects(month, '2026-13', 1);
    // @ts-expect-error a number is not a time value
    valueOf<typeof time>(1);
  });

  it('files and images', () => {
    for (const type of ['file', 'document'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, ASSET, { ...ASSET, mimeType: null, uploadedAt: '2026-11-17' });
      rejects(field, { url: 'u' }, 'u', null);
    }
    for (const type of ['files', 'documents'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, [], [ASSET]);
      rejects(field, [1], ASSET);
    }
    const file = def({ name: 'f', label: 'L', type: 'file', visibility: 'user' });
    // @ts-expect-error a file asset has a filename and a size
    valueOf<typeof file>({ url: 'u' });

    const image = def({ name: 'f', label: 'L', type: 'image', visibility: 'user' });
    accepts(image, 'https://x.io/a.png', PICTURE);
    rejects(image, 1, { fullUrl: 'u' });
    const images = def({ name: 'f', label: 'L', type: 'images', visibility: 'user' });
    accepts(images, [], ['https://x.io/a.png', PICTURE]);
    rejects(images, [1], 'u');
    // @ts-expect-error a number is not an image value
    valueOf<typeof image>(1);
  });

  it('complex', () => {
    const geopoint = def({ name: 'f', label: 'L', type: 'geopoint', visibility: 'user' });
    accepts(geopoint, { lat: 1, lng: 2 });
    rejects(geopoint, { lat: 1 });
    // @ts-expect-error a geopoint has lat and lng
    valueOf<typeof geopoint>({ lat: 1 });

    const address = def({ name: 'f', label: 'L', type: 'address', visibility: 'user' });
    accepts(address, { formatted_address: '1 rue X', latitude: 1, longitude: 2 });
    rejects(address, { latitude: 1, longitude: 2 });
    // @ts-expect-error an address has a formatted_address
    valueOf<typeof address>({ latitude: 1, longitude: 2 });

    const map = def({ name: 'f', label: 'L', type: 'map', visibility: 'user' });
    accepts(map, {}, { a: 1 });
    rejects(map, 1);
    const array = def({ name: 'f', label: 'L', type: 'array', visibility: 'user' });
    accepts(array, [], [1, 'a']);
    rejects(array, 'x');
    const fieldArray = def({ name: 'f', label: 'L', type: 'field-array', visibility: 'user' });
    accepts(fieldArray, [], [{ a: 1 }]);
    rejects(fieldArray, [1]);
    // @ts-expect-error a field-array holds row objects
    valueOf<typeof fieldArray>([1]);
  });

  it('selection: static options → union of option values', () => {
    for (const type of ['select', 'radio', 'combobox'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      accepts(field, 'a', 1);
      rejects(field, true);
    }
    const select = def({ name: 'f', label: 'L', type: 'select', visibility: 'user', validation: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } });
    accepts(select, 'a', 'b');
    rejects(select, 'c');
    // @ts-expect-error not an option value
    valueOf<typeof select>('c');

    const multiselect = def({ name: 'f', label: 'L', type: 'multiselect', visibility: 'user' });
    accepts(multiselect, [], ['x']);
    rejects(multiselect, 'x');
    const multiOptions = def({ name: 'f', label: 'L', type: 'multiselect', visibility: 'user', validation: { options: [{ value: 'a', label: 'A' }] } });
    accepts(multiOptions, ['a']);
    rejects(multiOptions, ['c']);
    // @ts-expect-error not an option value
    valueOf<typeof multiOptions>(['c']);
  });

  it('reference and buttons', () => {
    const reference = def({ name: 'f', label: 'L', type: 'reference', visibility: 'user' });
    accepts(reference, 'id1');
    rejects(reference, '', 1);
    // @ts-expect-error an id is a string
    valueOf<typeof reference>(1);

    for (const type of ['submit', 'reset'] as const) {
      const field = def({ name: 'f', label: 'L', type, visibility: 'user' });
      rejects(field, 'x', undefined);
    }
    const submit = def({ name: 'f', label: 'L', type: 'submit', visibility: 'user' });
    // @ts-expect-error a button has no value
    valueOf<typeof submit>('x');
  });

  it('custom types: validation.schema output, validation.reference id', () => {
    expectTypeOf<FieldValueOf<(typeof listing)['fields']['address']>>().toEqualTypeOf<{ street: string }>();
    expectTypeOf<FieldValueOf<(typeof listing)['fields']['owner']>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueOf<(typeof listing)['fields']['floor']>>().toEqualTypeOf<number>();
    expect(v.is(describeEntity(listing).fields.owner!.value.schema, '')).toBe(false);
  });
});

// ============================================================================
// 3. Key-set parity
// ============================================================================

/** Runtime twin of FieldTypeToKind (typed by it: a missing or wrong entry fails typecheck) */
const KINDS = {
  address: 'json', array: 'json', avatar: 'text', badge: 'text', boolean: 'boolean', checkbox: 'boolean',
  color: 'text', combobox: 'text', currency: 'number', date: 'date', 'datetime-local': 'timestamp',
  document: 'json', documents: 'json', duration: 'number', email: 'text', 'field-array': 'json', file: 'json',
  files: 'json', gdprConsent: 'json', geopoint: 'json', hidden: 'text', iban: 'text', image: 'json',
  images: 'json', map: 'json', month: 'text', multiselect: 'json', number: 'number', password: 'text',
  price: 'json', radio: 'text', range: 'number', rating: 'number', reference: 'ref', reset: 'text',
  richtext: 'text', select: 'text', submit: 'text', switch: 'boolean', tel: 'text', text: 'text',
  textarea: 'text', time: 'time', timestamp: 'timestamp', url: 'text', week: 'text', year: 'number',
} as const satisfies FieldTypeToKind;

describe('key-set parity', () => {
  it('FIELD_TYPES = BUILTIN_VALUES = FieldTypeToValue = FieldTypeToKind', () => {
    expect(Object.keys(BUILTIN_VALUES).sort()).toEqual([...FIELD_TYPES].sort());
    expect(Object.keys(KINDS).sort()).toEqual([...FIELD_TYPES].sort());
    expectTypeOf<keyof FieldTypeToValue>().toEqualTypeOf<BuiltInFieldType>();
    expectTypeOf<keyof FieldTypeToKind>().toEqualTypeOf<BuiltInFieldType>();
    expectTypeOf<keyof typeof KINDS>().toEqualTypeOf<BuiltInFieldType>();
  });

  it('BUILTIN_VALUES kinds = FieldTypeToKind (field without options)', () => {
    for (const type of FIELD_TYPES) {
      const { kind } = BUILTIN_VALUES[type];
      const field: EntityField = { name: 'f', label: 'L', type, visibility: 'user' };
      expect(typeof kind === 'function' ? kind(field) : kind, type).toBe(KINDS[type]);
    }
  });
});

// ============================================================================
// 7. Fail loud
// ============================================================================

describe('fail loud: custom type without value shape', () => {
  it('defineEntity throws and the field is a type error naming entity.field', () => {
    expect(() =>
      // @ts-expect-error custom type 'parity-district' without validation.schema / validation.reference
      defineEntity({ name: 'Apartment', collection: 'apartments', fields: { district_code: { name: 'district_code', label: 'District', type: 'parity-district', visibility: 'admin' } } })
    ).toThrow(/Apartment\.district_code.*parity-district.*validation\.schema.*validation\.reference/);

    type Check = RequireValueShapes<{ district_code: { name: 'district_code'; label: 'District'; type: 'parity-district'; visibility: 'admin' } }, 'Apartment'>;
    expectTypeOf<keyof Check['district_code']>().toEqualTypeOf<"Apartment.district_code: custom type 'parity-district' has no value shape, add validation.schema or validation.reference">();
  });

  it('a custom type whose validation.schema kind cannot be read: throw and type error', () => {
    expect(() =>
      defineEntity({
        name: 'Apartment',
        collection: 'apartments',
        fields: {
          // @ts-expect-error custom type 'parity-district' with a schema whose storage kind cannot be read
          district_code: { name: 'district_code', label: 'District', type: 'parity-district', visibility: 'admin', validation: { schema: v.custom<number>((input) => typeof input === 'number') } },
        },
      })
    ).toThrow(/Apartment\.district_code.*parity-district.*storage kind/);

    type Unreadable = { name: 'district_code'; label: 'District'; type: 'parity-district'; visibility: 'admin'; validation: { schema: v.UnknownSchema } };
    type Check = RequireValueShapes<{ district_code: Unreadable }, 'Apartment'>;
    expectTypeOf<keyof Check['district_code']>().toEqualTypeOf<"Apartment.district_code: custom type 'parity-district' has a validation.schema whose storage kind cannot be read, root it on a Valibot string, number, boolean, picklist, object or array schema, or set validation.reference">();
    expectTypeOf<FieldKindOf<Unreadable>>().toEqualTypeOf<never>();
  });

  it('readable schema or a reference on a custom type type-checks and resolves', () => {
    const readable = { name: 'district_code', label: 'District', type: 'parity-district', visibility: 'admin', validation: { schema: v.pipe(v.number(), v.integer()) } } as const;
    expect(resolveFieldValue(readable).kind).toBe('integer');
    expectTypeOf<RequireValueShapes<{ d: typeof readable }, 'Apartment'>['d']>().toEqualTypeOf<unknown>();
    const referenced = { name: 'owner', label: 'Owner', type: 'parity-owner', visibility: 'admin', validation: { schema: v.custom<string>((input) => typeof input === 'string'), reference: 'owners' } } as const;
    expect(resolveFieldValue(referenced).kind).toBe('ref');
    expectTypeOf<RequireValueShapes<{ o: typeof referenced }, 'Apartment'>['o']>().toEqualTypeOf<unknown>();
  });

  it('a custom type with a value shape type-checks', () => {
    type Check = RequireValueShapes<{ owner: { name: 'owner'; label: 'Owner'; type: 'parity-owner'; visibility: 'admin'; validation: { reference: 'owners' } } }, 'Apartment'>;
    expectTypeOf<Check['owner']>().toEqualTypeOf<unknown>();
  });
});
