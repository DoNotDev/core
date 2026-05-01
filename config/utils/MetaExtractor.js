/**
 * @fileoverview Meta Extractor
 * @description Extracts meta exports from TypeScript/JavaScript files using regex with JSX support. Works with both Vite and Next.js builds.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Extract meta export from file content using enhanced regex parsing
 * @param {string} code - The source code to parse
 * @param {string} filePath - The file path for better error reporting
 * @returns {object|null} - The extracted meta object or null if not found
 */
export function extractMeta(code, filePath = 'unknown') {
  try {
    // Enhanced regex to find meta export with JSX support
    const metaRegex = /export\s+const\s+meta\s*[^=]*=\s*(\{[\s\S]*?\});/;
    const match = code.match(metaRegex);

    if (!match) {
      return null;
    }

    // Extract the object string
    let objectString = match[1];

    // Handle JSX icons by extracting component names
    // Extract name between < and first space or /, then consume rest of tag: <Rocket />, <Rocket/>, <Icon className="..." />
    objectString = objectString.replace(
      /icon:\s*<(\w+)[\s\/][^>]*\/?>/g,
      (match, componentName) => {
        return `icon: '${componentName}'`;
      }
    );

    // Resolve variable references (like NAMESPACE)
    // Match both exported and non-exported const declarations
    const constRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g;
    const constMatches = [...code.matchAll(constRegex)];

    constMatches.forEach((match) => {
      const varName = match[1];
      const varValue = match[2];
      objectString = objectString.replace(
        new RegExp(`\\b${varName}\\b`, 'g'),
        `'${varValue}'`
      );
    });

    // Execute the resolved object string
    const metaObj = Function(`return ${objectString}`)();
    return metaObj;
  } catch (error) {
    // Silent failure - return null if meta extraction fails
    return null;
  }
}

/**
 * Extract auth configuration from meta object
 * @param {object} meta - The meta object
 * @returns {object} - The auth configuration
 */
export function extractAuthFromMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return { required: false };
  }

  // Handle different auth formats
  if (meta.auth === true) {
    return { required: true };
  } else if (meta.auth === false) {
    return { required: false };
  } else if (meta.auth && typeof meta.auth === 'object') {
    return meta.auth;
  }

  return { required: false };
}
