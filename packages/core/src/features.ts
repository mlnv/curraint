/**
 * Feature flags. Set to true to enable in-development features.
 */
export const ENABLE_COPILOT_PROVIDER =
  typeof process !== 'undefined' && process.env['CURRAINT_ENABLE_COPILOT'] === '1';
