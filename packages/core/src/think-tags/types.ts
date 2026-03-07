export type ThinkSegment =
  | { type: 'text'; content: string }
  | { type: 'think'; content: string };
