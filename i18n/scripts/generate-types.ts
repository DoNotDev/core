// packages/core/i18n/scripts/generate-types.ts

/**
 * @fileoverview I18n Type Generation Script
 * @description Script for generating TypeScript type definitions for i18n translation keys. Scans translation files and generates TypeScript interfaces for type-safe translations.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// /**
//  * Interface for options to control type generation
//  */
// interface TypeGenerationOptions {
//   /** Output directory for generated type definition files */
//   outputDir: string;
//   /** Root directory of the project */
//   rootDir: string;
//   /** Whether to overwrite existing files */
//   overwrite?: boolean;
//   /** Whether to output debug logs */
//   debug?: boolean;
// }

// /**
//  * Generate TypeScript type definitions for i18n translation keys
//  *
//  * This function scans translation files and generates TypeScript interfaces
//  * for each namespace to enable type-safe translations.
//  *
//  * @param options - Configuration options for type generation
//  */
// export async function generateTypeDefs(options: TypeGenerationOptions): Promise<void> {
//   const { outputDir, rootDir, overwrite = true, debug = false } = options;

//   // Ensure output directory exists
//   if (!fs.existsSync(outputDir)) {
//     fs.mkdirSync(outputDir, { recursive: true });
//   }

//   try {
//     // Find core namespaces
//     await processNamespaces(
//       path.join(rootDir, 'packages/core/i18n/src/locales/**/en.json'),
//       outputDir,
//       overwrite,
//       debug
//     );

//     // Find entity namespaces
//     await processNamespaces(
//       path.join(rootDir, 'packages/entities/*/src/locales/en.json'),
//       outputDir,
//       overwrite,
//       debug
//     );

//     // Find app namespaces
//     await processNamespaces(
//       path.join(rootDir, 'apps/*/src/locales/en.json'),
//       outputDir,
//       overwrite,
//       debug
//     );

//     // Generate index file
//     generateIndexFile(outputDir, debug);

//     if (debug) {
//       console.log('✅ Type definitions generated successfully');
//     }
//   } catch (error) {
//     console.error('❌ Error generating type definitions:', error);
//     throw error;
//   }
// }

// /**
//  * Process translation files and generate type definitions
//  *
//  * @param pattern - Glob pattern to find translation files
//  * @param outputDir - Directory to output generated files
//  * @param overwrite - Whether to overwrite existing files
//  * @param debug - Whether to output debug logs
//  */
// async function processNamespaces(
//   pattern: string,
//   outputDir: string,
//   overwrite: boolean,
//   debug: boolean
// ): Promise<void> {
//   try {
//     // Find all English translation files (the reference language)
//     const files = await glob(pattern);

//     if (debug) {
//       console.log(`Found ${files.length} translation files matching: ${pattern}`);
//     }

//     for (const file of files) {
//       // Parse file path to determine namespace
//       const parts = file.split('/');
//       let namespace = '';

//       if (file.includes('/core/i18n/')) {
//         // For core namespaces (auth, common, validation)
//         // packages/core/i18n/src/locales/<namespace>/en.json
//         namespace = parts[parts.indexOf('locales') + 1];
//       } else if (file.includes('/entities/')) {
//         // For entity namespaces
//         // packages/entities/<entity_name>/src/locales/en.json
//         namespace = parts[parts.indexOf('entities') + 1];
//       } else if (file.includes('/apps/')) {
//         // For app namespaces (app namespace is <app_name>-app)
//         // apps/<app_name>/src/locales/en.json
//         namespace = `${parts[parts.indexOf('apps') + 1]}-app`;
//       }

//       if (!namespace) {
//         if (debug) {
//           console.warn(`Could not determine namespace for file: ${file}`);
//         }
//         continue;
//       }

//       // Read translation file
//       const content = fs.readFileSync(file, 'utf8');
//       const translations = JSON.parse(content);

//       // Generate type definition
//       const typeDef = generateTypeDefinition(namespace, translations);

//       // Write to file
//       const outputFile = path.join(outputDir, `${namespace}.d.ts`);
//       if (overwrite || !fs.existsSync(outputFile)) {
//         fs.writeFileSync(outputFile, typeDef);
//         if (debug) {
//           console.log(`Generated type definition for namespace "${namespace}"`);
//         }
//       } else if (debug) {
//         console.log(`Skipped existing type definition for namespace "${namespace}"`);
//       }
//     }
//   } catch (error) {
//     console.error('Error processing namespaces:', error);
//     throw error;
//   }
// }

// /**
//  * Generate TypeScript interface for a namespace
//  *
//  * @param namespace - The namespace name
//  * @param translations - The translation object
//  * @returns TypeScript interface definition as a string
//  */
// function generateTypeDefinition(namespace: string, translations: Record<string, any>): string {
//   const interfaceName = `I18n${capitalize(namespace)}Namespace`;

//   // Generate interface content
//   const interfaceContent = generateInterfaceContent(translations, 1);

//   return `// This file is auto-generated. DO NOT EDIT.
// // Run "bun run generate:i18n-types" to regenerate.

// /**
//  * Type definition for the "${namespace}" i18n namespace
//  *
//  * This interface provides type safety for translations in the "${namespace}" namespace.
//  */
// export interface ${interfaceName} {
// ${interfaceContent}
// }

// // Extend the i18n types to include this namespace
// import 'react-i18next';

// declare module 'react-i18next' {
//   interface CustomTypeOptions {
//     resources: {
//       ${namespace}: ${interfaceName};
//     };
//   }
// }
// `;
// }

// /**
//  * Generate the contents of a TypeScript interface
//  *
//  * @param obj - The object to generate interface for
//  * @param indentLevel - Current indentation level
//  * @returns Interface content as a string
//  */
// function generateInterfaceContent(obj: Record<string, any>, indentLevel: number): string {
//   const indent = '  '.repeat(indentLevel);
//   let content = '';

//   for (const [key, value] of Object.entries(obj)) {
//     // Add comment for the key
//     content += `${indent}/**\n`;
//     content += `${indent} * ${key}\n`;
//     content += `${indent} */\n`;

//     if (typeof value === 'object' && value !== null) {
//       // Nested object
//       content += `${indent}${formatKey(key)}: {\n`;
//       content += generateInterfaceContent(value, indentLevel + 1);
//       content += `${indent}};\n\n`;
//     } else {
//       // Primitive value (string, number, etc.)
//       content += `${indent}${formatKey(key)}: string;\n\n`;
//     }
//   }

//   return content;
// }

// /**
//  * Format a key as a valid TypeScript property
//  * If the key contains special characters, it will be wrapped in quotes
//  *
//  * @param key - The key to format
//  * @returns Formatted key
//  */
// function formatKey(key: string): string {
//   // Check if key needs to be quoted (contains special characters)
//   return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
// }

// /**
//  * Capitalize the first letter of a string
//  *
//  * @param str - The string to capitalize
//  * @returns Capitalized string
//  */
// function capitalize(str: string): string {
//   return str.charAt(0).toUpperCase() + str.slice(1);
// }

// /**
//  * Generate an index file that exports all namespace type definitions
//  *
//  * @param outputDir - Directory containing generated type definitions
//  * @param debug - Whether to output debug logs
//  */
// function generateIndexFile(outputDir: string, debug: boolean): void {
//   // Get all generated .d.ts files
//   const files = fs.readdirSync(outputDir)
//     .filter(file => file.endsWith('.d.ts') && file !== 'index.d.ts');

//   let content = '// This file is auto-generated. DO NOT EDIT.\n\n';

//   // Export each type definition
//   for (const file of files) {
//     const namespace = file.replace('.d.ts', '');
//     content += `export * from './${namespace}';\n`;
//   }

//   // Write index file
//   fs.writeFileSync(path.join(outputDir, 'index.d.ts'), content);

//   if (debug) {
//     console.log(`Generated index file with ${files.length} namespace exports`);
//   }
// }
