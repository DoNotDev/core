/**
 * @fileoverview Peer Dependencies Resolver Utilities
 * @description Platform-agnostic utilities for resolving peer dependencies from app's node_modules when processing workspace package files. Used by both Vite and Next.js resolvers.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from '../utils/PathResolver.js';

/**
 * Extract base package name from import ID
 * Handles scoped packages and subpath imports
 * @param {string} id - Import ID (e.g., 'shiki', 'shiki/langs/typescript', '@donotdev/components/Button')
 * @returns {string} Base package name (e.g., 'shiki', '@donotdev/components')
 */
export function extractPackageName(id) {
  if (!id || typeof id !== 'string') return null;
  return id.startsWith('@')
    ? id.split('/').slice(0, 2).join('/') // @scope/package
    : id.split('/')[0]; // package
}

/**
 * Check if import ID is a bare import (not relative, absolute, or virtual)
 * @param {string} id - Import ID to check
 * @returns {boolean} True if bare import
 */
export function isBareImport(id) {
  if (!id || typeof id !== 'string') return false;
  return (
    !id.startsWith('.') &&
    !id.startsWith('/') &&
    !id.startsWith('\\') &&
    !id.startsWith('\0')
  );
}

/**
 * Check if file path is from a workspace package
 * @param {string} filePath - File path to check (may include @fs/ prefix from Vite)
 * @param {PathResolver} pathResolver - PathResolver instance
 * @returns {boolean} True if file is from workspace package
 */
export function isWorkspaceFile(filePath, pathResolver) {
  if (!filePath || !pathResolver) return false;

  const repoRoot = pathResolver.getRepoRoot();
  if (!repoRoot) return false;

  // Remove Vite's @fs/ prefix if present
  let cleanPath = filePath;
  if (filePath.startsWith('@fs/')) {
    cleanPath = filePath.slice(4);
  }

  const packagesDir = pathResolver.resolveRepoPath('packages');
  const normalizedPath = pathResolver.normalizePath(cleanPath);

  return packagesDir && normalizedPath.startsWith(packagesDir);
}

/**
 * Resolve peer dependency path from app's node_modules
 * @param {string} id - Import ID (full import including subpath if any)
 * @param {PathResolver} pathResolver - PathResolver instance
 * @returns {string|null} Resolved path or null if not found
 */
export function resolvePeerDependency(id, pathResolver) {
  if (!id || !pathResolver) return null;

  const packageName = extractPackageName(id);
  if (!packageName) return null;

  // Check if package exists in app's node_modules
  const packagePath = pathResolver.resolveAppPath(
    `node_modules/${packageName}`
  );
  if (!pathResolver.pathExists(packagePath)) {
    return null;
  }

  // Construct the full path (package + subpath if any)
  return pathResolver.resolveAppPath(`node_modules/${id}`);
}

/**
 * Check if a peer dependency should be resolved from app's node_modules
 * @param {string} id - Import ID
 * @param {string} importer - File path importing the dependency
 * @param {PathResolver} pathResolver - PathResolver instance
 * @returns {string|null} Resolved path or null if should not be resolved
 */
export function shouldResolvePeerDependency(id, importer, pathResolver) {
  if (!isBareImport(id)) return null;
  if (!isWorkspaceFile(importer, pathResolver)) return null;

  return resolvePeerDependency(id, pathResolver);
}
