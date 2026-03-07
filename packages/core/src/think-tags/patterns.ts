export const THINK_BLOCK_REGEX = /<\s*think\s*>([\s\S]*?)<\s*\/\s*think\s*>/gi;
export const REASONING_BLOCK_REGEX = /<\s*reasoning\s*>([\s\S]*?)<\s*\/\s*reasoning\s*>/gi;
export const ESCAPED_THINK_BLOCK_REGEX =
  /&lt;\s*think\s*&gt;([\s\S]*?)&lt;\s*\/\s*think\s*&gt;/gi;
export const ESCAPED_REASONING_BLOCK_REGEX =
  /&lt;\s*reasoning\s*&gt;([\s\S]*?)&lt;\s*\/\s*reasoning\s*&gt;/gi;
export const OPEN_OR_CLOSE_REASONING_TAG_REGEX =
  /(<\s*\/??\s*(think|reasoning)\s*>|&lt;\s*\/??\s*(think|reasoning)\s*&gt;)/gi;
export const OPEN_REASONING_TAG_PREFIX_REGEX =
  /^(<\s*(think|reasoning)\s*>|&lt;\s*(think|reasoning)\s*&gt;)/i;
