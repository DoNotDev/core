// packages/core/types/src/partners/schemas.ts

/**
 * @fileoverview Schema Definition for All Authentication and OAuth Partners
 * @description Single source of truth for all auth and OAuth configurations. Defines Valibot schemas for partner configurations, authentication partners, and OAuth partners.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

// Partner type distinguishes between authentication and OAuth API access
/**
 * Partner type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PartnerType = 'auth' | 'oauth' | 'both';

// Base schema for common partner properties
const basePartnerSchema = v.object({
  name: v.string(),
  color: v.string(),
  icon: v.string(),
  customParameters: v.optional(v.record(v.string(), v.string())),
  button: v.object({
    backgroundColor: v.string(),
    textColor: v.string(),
    borderColor: v.string(),
    hoverBackgroundColor: v.string(),
    focusOutlineColor: v.string(),
    fontWeight: v.optional(v.string(), '500'),
    textKey: v.optional(v.string()),
  }),
});

// Schema for authentication partners (Firebase Auth)
const authPartnerSchema = v.object({
  ...basePartnerSchema.entries,
  type: v.picklist(['auth', 'both']),
  scopes: v.optional(v.array(v.string())),
  firebaseProviderId: v.optional(v.string()),
});

// Helper function to validate URL or empty string
const urlOrEmptyString = v.union([v.literal(''), v.pipe(v.string(), v.url())]);

// Schema for OAuth endpoints with graceful handling of empty/placeholder URLs
const oauthEndpointsSchema = v.object({
  authUrl: urlOrEmptyString,
  tokenUrl: urlOrEmptyString,
  profileUrl: urlOrEmptyString,
  revokeUrl: v.optional(urlOrEmptyString),
});

// Schema for OAuth scopes based on purpose
const oauthScopesSchema = v.object({
  authentication: v.optional(v.array(v.string())),
  'api-access': v.array(v.string()),
});

// Schema for OAuth capabilities
const oauthCapabilitiesSchema = v.optional(
  v.object({
    pkce: v.optional(v.boolean(), false), // Provider supports PKCE
    codeChallengeMethod: v.optional(v.picklist(['S256', 'plain']), 'S256'),
  })
);

// Schema for OAuth partners
const oauthPartnerSchema = v.object({
  ...basePartnerSchema.entries,
  type: v.picklist(['oauth', 'both']),
  scopes: oauthScopesSchema,
  endpoints: oauthEndpointsSchema,
  capabilities: oauthCapabilitiesSchema,
});

// Define all supported auth partners
/**
 * Authentication partners configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const AUTH_PARTNERS = {
  apple: {
    name: 'Apple',
    color: '#000000',
    icon: 'apple',
    type: 'both',
    scopes: ['email', 'name'],
    firebaseProviderId: 'apple.com',
    customParameters: {
      prompt: 'login',
    },
    button: {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      borderColor: '#000000',
      hoverBackgroundColor: '#1a1a1a',
      focusOutlineColor: '#333333',
      fontWeight: '500',
      textKey: 'buttons.apple',
    },
  },
  discord: {
    name: 'Discord',
    color: '#5865F2',
    icon: 'discord',
    type: 'both',
    scopes: ['identify', 'email'],
    firebaseProviderId: 'discord.com',
    customParameters: {
      prompt: 'consent',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.discord',
    },
  },
  emailLink: {
    name: 'Email Link',
    color: '#10B981',
    icon: 'emailLink',
    type: 'auth',
    scopes: [],
    firebaseProviderId: 'emailLink',
    customParameters: {},
    button: {
      backgroundColor: '#10B981',
      textColor: '#ffffff',
      borderColor: '#10B981',
      hoverBackgroundColor: '#059669',
      focusOutlineColor: '#059669',
      fontWeight: '500',
      textKey: 'buttons.emailLink',
    },
  },
  facebook: {
    name: 'Facebook',
    color: '#1877F2',
    icon: 'facebook',
    type: 'both',
    scopes: ['email', 'public_profile'],
    firebaseProviderId: 'facebook.com',
    customParameters: {
      auth_type: 'reauthenticate',
    },
    button: {
      backgroundColor: '#1877F2',
      textColor: '#ffffff',
      borderColor: '#1877F2',
      hoverBackgroundColor: '#166FE5',
      focusOutlineColor: '#166FE5',
      fontWeight: '600',
      textKey: 'buttons.facebook',
    },
  },
  github: {
    name: 'GitHub',
    color: '#24292E',
    icon: 'github',
    type: 'both',
    scopes: ['read:user', 'user:email'],
    firebaseProviderId: 'github.com',
    customParameters: {
      allow_signup: 'true',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.github',
    },
  },
  google: {
    name: 'Google',
    color: '#4285F4',
    icon: 'google',
    type: 'both',
    scopes: ['email', 'profile'],
    firebaseProviderId: 'google.com',
    customParameters: {
      prompt: 'select_account',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.google',
    },
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0077B5',
    icon: 'linkedin',
    type: 'both',
    scopes: ['r_liteprofile', 'r_emailaddress'],
    firebaseProviderId: 'linkedin.com',
    customParameters: {
      prompt: 'consent',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.linkedin',
    },
  },
  microsoft: {
    name: 'Microsoft',
    color: '#00A4EF',
    icon: 'microsoft',
    type: 'both',
    scopes: ['openid', 'email', 'profile'],
    firebaseProviderId: 'microsoft.com',
    customParameters: {
      prompt: 'select_account',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.microsoft',
    },
  },
  password: {
    name: 'Email & Password',
    color: '#6B7280',
    icon: 'password',
    type: 'auth',
    scopes: [],
    firebaseProviderId: 'password',
    customParameters: {},
    button: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      borderColor: '#D1D5DB',
      hoverBackgroundColor: '#F9FAFB',
      focusOutlineColor: '#3B82F6',
      fontWeight: '500',
      textKey: 'buttons.password',
    },
  },
  reddit: {
    name: 'Reddit',
    color: '#FF4500',
    icon: 'reddit',
    type: 'both',
    scopes: ['identity'],
    firebaseProviderId: 'reddit.com',
    customParameters: {
      duration: 'permanent',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.reddit',
    },
  },
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    icon: 'spotify',
    type: 'both',
    scopes: ['user-read-email', 'user-read-private'],
    firebaseProviderId: 'spotify.com',
    customParameters: {
      show_dialog: 'true',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.spotify',
    },
  },
  twitch: {
    name: 'Twitch',
    color: '#9146FF',
    icon: 'twitch',
    type: 'both',
    scopes: ['user:read:email'],
    firebaseProviderId: 'twitch.tv',
    customParameters: {
      force_verify: 'true',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.twitch',
    },
  },
  twitter: {
    name: 'X',
    color: '#000000',
    icon: 'twitter',
    type: 'both',
    scopes: [],
    firebaseProviderId: 'twitter.com',
    customParameters: {
      force_login: 'true',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.twitter',
    },
  },
  yahoo: {
    name: 'Yahoo',
    color: '#5F01D1',
    icon: 'yahoo',
    type: 'both',
    scopes: ['openid', 'email', 'profile'],
    firebaseProviderId: 'yahoo.com',
    customParameters: {
      prompt: 'select_account',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
      textKey: 'buttons.yahoo',
    },
  },
} as const;

// Define all supported OAuth partners
/**
 * OAuth partners configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const OAUTH_PARTNERS = {
  google: {
    name: 'Google',
    color: '#4285F4',
    icon: 'google',
    type: 'both',
    scopes: {
      authentication: ['openid', 'profile', 'email'],
      'api-access': [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    },
    endpoints: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      profileUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  github: {
    name: 'GitHub',
    color: '#24292E',
    icon: 'github',
    type: 'both',
    scopes: {
      authentication: ['read:user', 'user:email'],
      'api-access': ['repo', 'user', 'read:org', 'gist', 'notifications'],
    },
    endpoints: {
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      profileUrl: 'https://api.github.com/user',
      revokeUrl: 'https://api.github.com/applications/CLIENT_ID/token',
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  discord: {
    name: 'Discord',
    color: '#5865F2',
    icon: 'discord',
    type: 'both',
    scopes: {
      authentication: ['identify', 'email'],
      'api-access': ['guilds', 'guilds.members.read', 'bot', 'messages.read'],
    },
    endpoints: {
      authUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      profileUrl: 'https://discord.com/api/users/@me',
      revokeUrl: 'https://discord.com/api/oauth2/token/revoke',
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    icon: 'spotify',
    type: 'both',
    scopes: {
      authentication: ['user-read-email', 'user-read-private'],
      'api-access': [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'playlist-read-private',
        'playlist-modify-public',
        'user-library-read',
      ],
    },
    endpoints: {
      authUrl: 'https://accounts.spotify.com/authorize',
      tokenUrl: 'https://accounts.spotify.com/api/token',
      profileUrl: 'https://api.spotify.com/v1/me',
      revokeUrl: 'https://accounts.spotify.com/api/token',
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  twitch: {
    name: 'Twitch',
    color: '#9146FF',
    icon: 'twitch',
    type: 'both',
    scopes: {
      authentication: ['user:read:email'],
      'api-access': [
        'channel:read:subscriptions',
        'bits:read',
        'channel:manage:broadcast',
        'channel:read:stream_key',
        'user:read:follows',
      ],
    },
    endpoints: {
      authUrl: 'https://id.twitch.tv/oauth2/authorize',
      tokenUrl: 'https://id.twitch.tv/oauth2/token',
      profileUrl: 'https://api.twitch.tv/helix/users',
      revokeUrl: 'https://id.twitch.tv/oauth2/revoke',
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  reddit: {
    name: 'Reddit',
    color: '#FF4500',
    icon: 'reddit',
    type: 'both',
    scopes: {
      authentication: ['identity'],
      'api-access': ['read', 'submit', 'vote', 'mysubreddits', 'subscribe'],
    },
    endpoints: {
      authUrl: 'https://www.reddit.com/api/v1/authorize',
      tokenUrl: 'https://www.reddit.com/api/v1/access_token',
      profileUrl: 'https://oauth.reddit.com/api/v1/me',
      revokeUrl: 'https://www.reddit.com/api/v1/revoke_token',
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0077B5',
    icon: 'linkedin',
    type: 'oauth',
    scopes: {
      'api-access': [
        'r_liteprofile',
        'r_emailaddress',
        'w_member_social',
        'r_organization_social',
      ],
    },
    endpoints: {
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      profileUrl: 'https://api.linkedin.com/v2/me',
      revokeUrl: 'https://www.linkedin.com/oauth/v2/revoke',
    },
    capabilities: {
      pkce: false, // LinkedIn doesn't support PKCE
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  slack: {
    name: 'Slack',
    color: '#E01E5A',
    icon: 'slack',
    type: 'oauth',
    scopes: {
      'api-access': [
        'channels:read',
        'chat:write',
        'users:read',
        'files:read',
        'im:read',
      ],
    },
    endpoints: {
      authUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      profileUrl: 'https://slack.com/api/users.identity',
      revokeUrl: 'https://slack.com/api/auth.revoke',
    },
    capabilities: {
      pkce: false, // Slack doesn't support PKCE
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  notion: {
    name: 'Notion',
    color: '#000000',
    icon: 'notion',
    type: 'oauth',
    scopes: {
      'api-access': ['read', 'write'],
    },
    endpoints: {
      authUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      profileUrl: 'https://api.notion.com/v1/users/me',
      revokeUrl: 'https://api.notion.com/v1/oauth/revoke',
    },
    capabilities: {
      pkce: false, // Notion doesn't support PKCE
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  medium: {
    name: 'Medium',
    color: '#000000',
    icon: 'medium',
    type: 'oauth',
    scopes: {
      'api-access': ['basicProfile', 'publishPost', 'listPublications'],
    },
    endpoints: {
      authUrl: 'https://medium.com/m/oauth/authorize',
      tokenUrl: 'https://medium.com/v1/tokens',
      profileUrl: 'https://medium.com/v1/me',
      revokeUrl: 'https://medium.com/v1/tokens/revoke',
    },
    capabilities: {
      pkce: false, // Medium doesn't support PKCE
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  twitter: {
    name: 'X',
    color: '#000000',
    icon: 'twitter',
    type: 'oauth',
    scopes: {
      'api-access': [
        'tweet.read',
        'users.read',
        'follows.read',
        'tweet.write',
        'like.write',
      ],
    },
    endpoints: {
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      profileUrl: 'https://api.twitter.com/2/users/me',
      revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
    },
    capabilities: {
      pkce: true, // Twitter/X supports PKCE
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  mastodon: {
    name: 'Mastodon',
    color: '#6364FF',
    icon: 'mastodon',
    type: 'oauth',
    scopes: {
      'api-access': ['read', 'write', 'follow', 'push'],
    },
    endpoints: {
      authUrl: '', // Instance-specific
      tokenUrl: '', // Instance-specific
      profileUrl: '', // Instance-specific
      revokeUrl: '', // Instance-specific
    },
    capabilities: {
      pkce: true, // Mastodon supports PKCE
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    icon: 'youtube',
    type: 'oauth',
    scopes: {
      'api-access': [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl',
      ],
    },
    endpoints: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      profileUrl: 'https://www.googleapis.com/youtube/v3/channels',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
    },
    capabilities: {
      pkce: true, // YouTube (Google) supports PKCE
      codeChallengeMethod: 'S256',
    },
    button: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
  supabase: {
    name: 'Supabase',
    color: '#3ECF8E',
    icon: 'supabase',
    type: 'oauth',
    scopes: {
      // Scopes configured at OAuth app creation time (Supabase org settings).
      // Users must re-authorize if scopes change.
      'api-access': [
        'auth:read',
        'auth:write',
        'database:read',
        'database:write',
        'domains:read',
        'domains:write',
        'edge_functions:read',
        'edge_functions:write',
        'environment:read',
        'environment:write',
        'organizations:read',
        'projects:read',
        'projects:write',
        'rest:read',
        'rest:write',
        'secrets:read',
        'secrets:write',
        'storage:read',
      ],
    },
    endpoints: {
      authUrl: 'https://api.supabase.com/v1/oauth/authorize',
      tokenUrl: 'https://api.supabase.com/v1/oauth/token',
      profileUrl: '', // No userinfo endpoint — use GET /v1/organizations
      revokeUrl: '', // Revocation via dashboard only
    },
    capabilities: {
      pkce: true,
      codeChallengeMethod: 'S256',
    },
    button: {
      // Official Supabase "Connect Supabase" light button kit
      backgroundColor: '#F1F3F5',
      textColor: '#11181C',
      borderColor: '#E6E8EB',
      hoverBackgroundColor: '#E6E8EB',
      focusOutlineColor: '#3ECF8E',
      fontWeight: '500',
    },
  },
  vercel: {
    name: 'Vercel',
    color: '#000000',
    icon: 'vercel',
    type: 'oauth',
    scopes: {
      // "Sign in with Vercel" (OIDC) — for user authentication
      authentication: ['openid', 'email', 'profile', 'offline_access'],
      // Vercel Integrations — for resource management (separate flow)
      // Note: cannot create projects via OAuth (confirmed March 2026)
      'api-access': [
        'project',
        'project-env-vars',
        'deployment',
        'team',
        'user',
      ],
    },
    endpoints: {
      // "Sign in with Vercel" (OIDC) endpoints
      authUrl: 'https://vercel.com/oauth/authorize',
      tokenUrl: 'https://api.vercel.com/login/oauth/token',
      profileUrl: 'https://api.vercel.com/login/oauth/userinfo',
      revokeUrl: 'https://api.vercel.com/login/oauth/token/revoke',
    },
    capabilities: {
      pkce: true, // PKCE is REQUIRED for Vercel
      codeChallengeMethod: 'S256',
    },
    button: {
      // No OAuth button brand requirement from Vercel - neutral outline
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#d1d5db',
      hoverBackgroundColor: '#f9fafb',
      focusOutlineColor: '#3b82f6',
      fontWeight: '500',
    },
  },
} as const;

// Validate schemas
const authPartnersSchema = v.record(v.string(), authPartnerSchema);
const oauthPartnersSchema = v.record(v.string(), oauthPartnerSchema);

// Lazy schema validation - only validates when explicitly called
// This prevents breaking apps that don't use auth/oauth features
/**
 * Validates authentication partners configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateAuthPartners() {
  return v.safeParse(authPartnersSchema, AUTH_PARTNERS);
}

/**
 * Validates OAuth partners configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateOAuthPartners() {
  return v.safeParse(oauthPartnersSchema, OAUTH_PARTNERS);
}

// Optional runtime validation during development (only if explicitly enabled)
// Removed automatic validation to prevent breaking apps that don't use these features

// Export types generated from the schema
// Updated to include password and emailLink partners
/**
 * Authentication partner ID type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthPartnerId = keyof typeof AUTH_PARTNERS;

/**
 * OAuth partner ID type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthPartnerId = keyof typeof OAUTH_PARTNERS;

/**
 * Partner ID type (auth or OAuth)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PartnerId = AuthPartnerId | OAuthPartnerId;

// Create derived types using Valibot schema inference
/**
 * Authentication partner type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthPartner = v.InferOutput<typeof authPartnerSchema>;

/**
 * OAuth partner type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthPartner = (typeof OAUTH_PARTNERS)[OAuthPartnerId];

// Utility to check if a partner ID is an auth partner
/**
 * Checks if a partner ID is an authentication partner
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isAuthPartnerId(id: PartnerId): id is AuthPartnerId {
  return id in AUTH_PARTNERS;
}

// Utility to check if a partner ID is an OAuth partner
/**
 * Checks if a partner ID is an OAuth partner
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isOAuthPartnerId(id: PartnerId): id is OAuthPartnerId {
  return id in OAUTH_PARTNERS;
}
