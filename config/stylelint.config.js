/**
 * @fileoverview Stylelint Configuration
 * @description Stylelint configuration for CSS files in the DoNotDev framework.
 * Catches syntax errors like invalid // comments that break CSS parsing.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // CRITICAL: Prevent invalid double-slash comments (CSS only supports /* */)
    'no-invalid-double-slash-comments': true,

    // Disable ALL stylistic rules (focus on syntax errors only)
    'rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'declaration-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'import-notation': null,
    'value-keyword-case': null,
    'alpha-value-notation': null,
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'declaration-block-no-redundant-longhand-properties': null,

    // Allow CSS nesting (we use postcss-nesting)
    'selector-nested-pattern': null,
    'no-descending-specificity': null,

    // Allow duplicate selectors (intentional for specificity)
    'no-duplicate-selectors': null,

    // Allow custom properties (CSS variables)
    'custom-property-pattern': null,

    // Allow vendor prefixes (autoprefixer handles this)
    'property-no-vendor-prefix': null,
    'value-no-vendor-prefix': null,

    // Allow responsive utilities with escaped colons & arbitrary values
    'selector-class-pattern': null,

    // Allow modern CSS features
    'declaration-property-value-no-unknown': null,
    'media-feature-name-value-no-unknown': null,

    // Allow deprecated properties (legacy browser support)
    'property-no-deprecated': null,
    'declaration-property-value-keyword-no-deprecated': null,

    // Allow empty blocks (utility-first CSS)
    'block-no-empty': null,
  },
};
