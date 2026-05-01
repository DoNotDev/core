# @donotdev/schemas

Validation schemas and type generation for DoNotDev applications. All schemas are server-safe by default and can be used in both client and server environments.

## Structure

Import from the main package for all validation functions:

```typescript
import {
  validateDocument,
  validateUniqueFields,
  enhanceSchema,
} from '@donotdev/schemas';
```

**Available modules:**

- `validateDates.ts` - Date validation utilities
- `validateDocument.ts` - Document validation against schemas
- `validateUniqueFields.ts` - Uniqueness validation registry and utilities
- `enhanceSchema.ts` - Schema enhancement utilities
- `getSchemaType.ts` - Valibot type utilities
- `createSchema.ts` - Schema creation utilities
- `defineEntity.ts` - Entity definition utilities
- `utils.ts` - General utilities
- `visibility.ts` - Visibility utilities

## Usage Examples

### Client-Side (Browser/SSR)

```typescript
import { validateDocument, validateUniqueFields } from '@donotdev/schemas';

// Validate a document against a schema
await validateDocument(schema, data, 'create');

// Validate unique fields (requires validator to be registered)
await validateUniqueFields(schema, data);
```

### Server-Side (API Routes, Server Actions)

```typescript
import { createFirestoreValidator } from '@donotdev/firebase/server';
import { registerUniqueConstraintValidator } from '@donotdev/schemas';

// Register the Firestore validator for uniqueness checks
const validator = await createFirestoreValidator();
registerUniqueConstraintValidator(validator);

// Now uniqueness validation will work
await validateUniqueFields(schema, data);
```

## Registry Pattern

The schemas package uses a registry pattern for database adapters:

1. **Client-safe functions** are always available and work with any registered validator
2. **Server-only adapters** register themselves with the client-safe functions
3. **No direct coupling** between client and server code

### Example: Uniqueness Validation

```typescript
// Client-side (always available)
import {
  validateUniqueFields,
  registerUniqueConstraintValidator,
} from '@donotdev/schemas';

// Server-side (registers the validator)
import { createFirestoreValidator } from '@donotdev/firebase/server';

// Register the validator
const validator = await createFirestoreValidator();
registerUniqueConstraintValidator(validator);

// Now client-side validation works with the server validator
await validateUniqueFields(schema, data);
```

## Key Benefits

1. **No Client Bundling Issues**: Server-only adapters are never bundled in client builds
2. **Flexible Architecture**: Can easily add new database adapters (PostgreSQL, MongoDB, etc.)
3. **Clear Separation**: Easy to understand what's safe for client vs server
4. **Type Safety**: Full TypeScript support for both client and server functions
5. **Framework Agnostic**: Works with Next.js, Vite, and other frameworks

## Migration Guide

If you were previously importing adapters from the main package:

**Before:**

```typescript
import { createFirestoreValidator } from '@donotdev/firebase/server';
```

**After:**

```typescript
import { createFirestoreValidator } from '@donotdev/firebase/server';
```

## Adding New Database Adapters

To add support for a new database:

1. Create a new adapter file in `src/validation/adapters/`
2. Implement the `UniqueConstraintValidator` interface
3. Export from `src/server/index.ts`
4. The adapter will automatically be available via `@donotdev/firebase/server`

### Example: PostgreSQL Adapter

```typescript
// src/validation/adapters/postgresql.ts
export async function createPostgreSQLValidator(): Promise<UniqueConstraintValidator> {
  // Implementation here
  return {
    checkDuplicate: async (collection, field, value, currentDocId) => {
      // PostgreSQL-specific logic
    },
  };
}
```

## Features

- Type-safe schema definition
- Field validation using Valibot
- Schema generation for CRUD operations
- Enhanced validation for Firestore documents
- Support for both client and server validation

## Usage

### Defining an Entity

```typescript
import { defineEntity } from '@donotdev/schemas';

export const User = defineEntity({
  name: 'User',
  collection: 'users',
  fields: {
    email: {
      type: 'email',
      visibility: 'user',
      validation: {
        required: true,
      },
      label: 'Email Address',
    },
    password: {
      type: 'password',
      visibility: 'user',
      validation: {
        required: true,
        minLength: 8,
      },
      label: 'Password',
    },
    role: {
      type: 'select',
      visibility: 'admin',
      validation: {
        required: true,
        options: [
          { value: 'user', label: 'User' },
          { value: 'admin', label: 'Admin' },
        ],
      },
      label: 'Role',
    },
  },
});
```

### Creating Schemas

```typescript
import { createSchemas } from '@donotdev/schemas';
import { User } from './entities/user';

const userSchemas = createSchemas(User);

// Generated schemas include:
// userSchemas.CreateUserSchema - for creating new users
// userSchemas.UpdateUserSchema - for updating users
// userSchemas.GetUserSchema - for retrieving users
// userSchemas.GetUserAdminSchema - for admin-level access
// userSchemas.ListUserSchema - for listing users
```

### Validating Documents

```typescript
import { validateDocument, enhanceSchema } from '@donotdev/schemas';
import * as v from 'valibot';

// Create a schema with enhanced validation
const userSchema = enhanceSchema(
  v.object({
    email: v.pipe(v.string(), v.email()),
    username: v.pipe(v.string(), v.minLength(3)),
  }),
  {
    collection: 'users',
    uniqueFields: [
      { field: 'email', errorMessage: 'Email already in use' },
      { field: 'username', errorMessage: 'Username already taken' },
    ],
  }
);

// Validate a document
async function createUser(userData) {
  try {
    // This will:
    // 1. Validate against the validation schema
    // 2. Validate date formats
    // 3. Check for uniqueness constraints
    await validateDocument(userSchema, userData, 'create');

    // If validation passes, save the document
    return saveUserToDatabase(userData);
  } catch (error) {
    console.error('Validation failed:', error);
    throw error;
  }
}
```

### Setting Up Backend Validation

For server-side uniqueness validation, register a Firestore adapter:

```typescript
import {
  createAdminFirestoreAdapter,
  validateDocument,
} from '@donotdev/schemas';

// Initialize in your server startup code
async function initializeValidation() {
  await createAdminFirestoreAdapter();

  // Now uniqueness checks will work in validateDocument
}
```

## Installation

```bash
bun add @donotdev/schemas
```

## Entity Definition

### Field Types

```typescript
type FieldType =
  | 'array' // Array of values
  | 'boolean' // True/False value
  | 'checkbox' // Checkbox input
  | 'color' // Color picker
  | 'date' // Date picker
  | 'datetime-local' // Date and time picker
  | 'email' // Email input
  | 'file' // File upload
  | 'geopoint' // Location coordinates
  | 'hidden' // Hidden input
  | 'image' // Image upload
  | 'map' // Key-value pairs
  | 'month' // Month picker
  | 'multiselect' // Multiple select
  | 'number' // Numeric input
  | 'password' // Password input
  | 'radio' // Radio buttons
  | 'range' // Range slider
  | 'reference' // Document reference
  | 'reset' // Reset button
  | 'select' // Single select
  | 'submit' // Submit button
  | 'tel' // Phone number
  | 'text' // Text input
  | 'textarea' // Multi-line text
  | 'time' // Time picker
  | 'timestamp' // Timestamp
  | 'url' // URL input
  | 'week'; // Week picker
```

### Field Value Types

The package provides automatic type inference for field values:

```typescript
type FieldTypeToValue = {
  array: any[];
  boolean: boolean;
  checkbox: boolean;
  color: string;
  date: string;
  'datetime-local': string;
  email: string;
  file: File | null;
  geopoint: { lat: number; lng: number };
  hidden: string;
  image: File | null;
  map: Record<string, any>;
  month: string;
  multiselect: string[];
  number: number;
  password: string;
  radio: string;
  reference: string;
  range: number;
  reset: never;
  select: string;
  submit: never;
  tel: string;
  text: string;
  textarea: string;
  time: string;
  timestamp: Date;
  url: string;
  week: string;
};

type ValueTypeForField<T extends FieldType> = FieldTypeToValue[T];
```

### Field Visibility

```typescript
type Visibility =
  | 'user' // Visible to all users
  | 'admin' // Only visible to admins
  | 'technical'; // System managed fields
```

### Enhanced Field Validation

The package provides type-safe validation rules based on field types:

```typescript
interface ValidationRules<T extends FieldType = FieldType> {
  required?: boolean;
  min?: T extends 'number' | 'range' ? number : never;
  max?: T extends 'number' | 'range' ? number : never;
  minLength?: T extends
    | 'text'
    | 'textarea'
    | 'password'
    | 'email'
    | 'url'
    | 'tel'
    ? number
    : never;
  maxLength?: T extends
    | 'text'
    | 'textarea'
    | 'password'
    | 'email'
    | 'url'
    | 'tel'
    ? number
    : never;
  pattern?: T extends 'text' | 'textarea' | 'password' | 'email' | 'url' | 'tel'
    ? string
    : never;
  options?: T extends 'select' | 'multiselect' | 'radio'
    ? Array<{ value: string; label: string }>
    : never;
  reference?: T extends 'reference' ? string : never;
}
```

### Field Definition

```typescript
interface EntityField {
  type: FieldType;
  visibility: Visibility;
  validation?: ValidationRules;
  i18n?: boolean;
  label?: string;
  hint?: string;
}
```

## Technical Fields

Every entity automatically gets these fields with proper type safety:

```typescript
interface BaseEntityFields {
  id: {
    type: 'text';
    visibility: 'technical';
    validation: {
      required: true;
      pattern: string; // Firestore ID pattern
    };
  };
  createdAt: {
    type: 'date';
    visibility: 'technical';
    validation: {
      required: true;
    };
  };
  updatedAt: {
    type: 'date';
    visibility: 'technical';
    validation: {
      required: true;
    };
  };
  createdById: {
    type: 'text';
    visibility: 'technical';
    validation: {
      required: true;
    };
  };
  updatedById: {
    type: 'text';
    visibility: 'technical';
    validation: {
      required: true;
    };
  };
}
```

## Constants

The package provides useful constants:

```typescript
export const FIRESTORE_ID_PATTERN = /^[0-9a-zA-Z]+$/;
```

## Type Safety

The package ensures type safety at multiple levels:

1. Field type validation
2. Field value type inference
3. Validation rules based on field type
4. Technical fields enforcement
5. Schema generation with proper types

## Example Usage

In React components with full type inference:

```typescript
function ProductForm() {
  const schema = useProductSchema('create');

  // Form values are properly typed based on field definitions
  const form = useForm({
    resolver: valibotResolver(schema)
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('name')} />
      {form.errors.name && (
        <span>{form.errors.name.message}</span>
      )}
    </form>
  );
}
```

In backend functions:

```typescript
import { schemas } from '@donotdev/product';

// Data is properly typed based on schema
async function createProduct(data: unknown) {
  const validated = schemas.create.parse(data);
  return db.collection('products').add(validated);
}
```

## Best Practices

1. **Type Safety**
   - Leverage type inference for fields
   - Use proper field types
   - Let TypeScript validate your entities

2. **Entity Structure**
   - Use meaningful field names
   - Set correct visibility levels
   - Enable i18n for user-visible fields
   - Add appropriate validation rules

3. **Field Types**
   - Choose specific field types over generic ones
   - Use `reference` for relationships
   - Use appropriate date/time fields
   - Consider UX when choosing input types

4. **Technical Fields**
   - Don't modify technical field definitions
   - They're managed by DoNotDev
   - Always use appropriate visibility

## 📄 License & Ownership

All rights reserved.  
The DoNotDev framework and its premium features are the exclusive property of **Ambroise Park Consulting**.

- Licensed under MIT. See LICENSE.md.

© Ambroise Park Consulting – 2025
