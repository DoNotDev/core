/**
 * @fileoverview JSDoc type definitions for esbuild configuration
 * @description Type definitions for Firebase Functions/Vercel builds in JS-only package
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Workspace environment types
 * @typedef {('dndev'|'external'|'npm')} WorkspaceType
 */

/**
 * Workspace information
 * @typedef {Object} Workspace
 * @property {WorkspaceType} type
 * @property {string} root
 */

/**
 * esbuild configuration options
 * @typedef {Object} EsbuildConfigOptions
 * @property {string} [entry]
 * @property {string} [outDir]
 * @property {boolean} [minify]
 * @property {boolean} [sourcemap]
 * @property {('firebase'|'vercel'|'framework')} [platform]
 * @property {boolean} [bundleWorkspaceDeps]
 * @property {boolean} [importFramework]
 * @property {boolean} [external]
 * @property {Workspace} [workspace]
 */

/**
 * esbuild configuration object
 * @typedef {Object} EsbuildConfig
 * @property {(string|string[]|Object<string,string>)} entryPoints
 * @property {boolean} bundle
 * @property {string} platform
 * @property {string} target
 * @property {string} format
 * @property {string} outdir
 * @property {Object<string,string>} outExtension
 * @property {boolean} minify
 * @property {boolean} sourcemap
 * @property {boolean} metafile
 * @property {string} logLevel
 * @property {Object<string,string>} [alias]
 * @property {string[]} [external]
 * @property {Object<string,string>} [define]
 */

/**
 * Function build context
 * @typedef {Object} FunctionBuildContext
 * @property {Workspace} workspace
 * @property {boolean} isRootFunctions
 * @property {boolean} isAppFunctions
 */

// This file intentionally contains only JSDoc typedefs for editor/IDE support.
// No runtime exports are required.
