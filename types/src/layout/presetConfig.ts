// packages/core/types/src/layout/presetConfig.ts

/**
 * @fileoverview Preset Configuration Types
 * @description Config-based preset system types. Presets are configuration objects
 * that declare what components go in which slots, replacing the component-based approach.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ComponentType, ReactNode } from 'react';

import type { Breakpoint } from './breakpoint';
import type { FooterMode, LayoutPreset } from './layoutConstants';

/**
 * Slot content function - returns ReactNode or null
 *
 * Presets use functions that return ReactNode, same API as consumers.
 * Return null to explicitly hide the slot.
 */
export type SlotContent = () => ReactNode | null;

/**
 * Header zone configuration
 *
 * Grid-based layout with start/center/end areas.
 * - start: start-aligned (typically branding: AppIcon, AppTitle)
 * - center: absolutely centered (overlay, regardless of start/end content)
 * - end: end-aligned (typically actions: GoTo, Auth, Language, Theme)
 */
export interface HeaderZoneConfig {
  /** Start slot - start-aligned, typically branding (AppIcon, AppTitle) */
  start?: SlotContent;

  /** Center slot - absolutely centered overlay, optional (navigation, search) */
  center?: SlotContent;

  /** End slot - end-aligned, typically actions (GoTo, Auth, Language, Theme) */
  end?: SlotContent;
}

/**
 * Sidebar zone configuration
 *
 * Vertical layout with top/content/bottom areas.
 * All sidebars use ResizableSidebar wrapper.
 */
export interface SidebarZoneConfig {
  /** Top slot - branding, search */
  top?: SlotContent;

  /** Content slot - main scrollable area (defaults to NavigationMenu) */
  content?: SlotContent;

  /** Bottom slot - user profile, settings */
  bottom?: SlotContent;

  /** Default sidebar width in pixels */
  defaultWidth?: number;

  /** Minimum width when resizing */
  minWidth?: number;

  /** Maximum width when resizing */
  maxWidth?: number;
}

/**
 * Footer zone configuration
 *
 * Simple footer: Copyright (left) | LegalLinks + DoNotDev (right)
 * - `null`: Hide footer
 * - `undefined`: Use defaults (copyright + legal links + DoNotDev)
 * - `{ copyright?: ..., legalLinks?: ... }`: Custom configuration
 */
export interface FooterConfig {
  /** Copyright configuration
   * - `null`: Hide copyright
   * - `undefined`: Use default (© YEAR appName. All rights reserved)
   * - `string`: Custom copyright text
   */
  copyright?: null | string;
  /** Legal links configuration
   * - `null`: Hide legal links
   * - `Array<{ path, label }>`: Custom legal links
   * - `undefined`: Use framework defaults
   */
  legalLinks?: null | Array<{
    path: string;
    label: string;
  }>;
}

/**
 * Footer zone configuration
 *
 * - `FooterConfig` object: configure DnDevFooter (copyright, legal links)
 * - `SlotContent` function: replace DnDevFooter with custom component
 * - `null`: hide footer
 * - `undefined`: use defaults
 */
export type FooterZoneConfig = FooterConfig | SlotContent | null;

/**
 * MergedBar configuration for mobile
 *
 * Fixed trigger bar that opens a Sheet with navigation content.
 * Each slot is customizable per-preset, with smart defaults.
 */
export interface MergedBarConfig {
  /** Position of the trigger bar */
  position: 'top' | 'bottom';

  /** Height of the trigger bar (default: 64px for top, 48px for bottom) */
  height?: string;

  /** Trigger bar content (default: header.start for top, footer-like for bottom) */
  trigger?: SlotContent;

  /** Sheet top slot */
  top?: SlotContent;

  /** Sheet content slot - scrollable (default: sidebar.content) */
  content?: SlotContent;

  /** Sheet bottom slot (default: sidebar.bottom) */
  bottom?: SlotContent;
}

/**
 * Mobile behavior configuration
 *
 * Defines how the layout adapts on mobile/tablet breakpoints.
 */
export interface MobileBehaviorConfig {
  /** Breakpoint at which mobile behavior activates (default: 1024px) */
  breakpoint?: number;

  /** Header slot overrides for mobile (overrides desktop header slots) */
  header?: HeaderZoneConfig;

  /** Sidebar slot overrides for mobile (overrides desktop sidebar slots) */
  sidebar?: SidebarZoneConfig;

  /** MergedBar configuration - replaces header/footer with sheet trigger */
  mergedBar?: MergedBarConfig;
}

/**
 * Complete preset configuration
 *
 * Declarative configuration for a layout preset.
 * Uses function-based slots, same API as consumers.
 *
 * @example
 * ```typescript
 * const landingPreset: PresetConfig = {
 *   name: 'landing',
 *   header: {
 *     start: () => <AppBranding />,
 *     center: () => null,
 *     end: () => (
 *       <>
 *         <GoTo />
 *         <AuthHeader />
 *       </>
 *     ),
 *   },
 *   mobile: {
 *     header: {
 *       end: () => <HeaderMenu>{desktop end content}</HeaderMenu>,
 *     },
 *   },
 * };
 * ```
 */
export interface PresetConfig {
  /** Preset identifier (must match LayoutPreset type) */
  name: LayoutPreset;

  /** Header zone configuration (undefined = use defaults, object = override slots, function = custom mode) */
  header?: HeaderZoneConfig | SlotContent;

  /** Sidebar zone configuration (undefined = use defaults, object = override slots, function = custom mode) */
  sidebar?: SidebarZoneConfig | SlotContent;

  /** Footer zone configuration (undefined = use defaults, object = override) */
  footer?: FooterZoneConfig;

  /** Footer scroll behavior override for this preset */
  footerMode?: FooterMode;

  /** Mobile behavior configuration */
  mobile?: MobileBehaviorConfig;
}

/**
 * Preset registry type
 *
 * Maps preset names to their configurations.
 */
export type PresetRegistry = Record<LayoutPreset, PresetConfig>;
