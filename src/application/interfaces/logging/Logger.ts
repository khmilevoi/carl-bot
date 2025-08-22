export interface Logger {
  debug(message: string): void;
  debug(meta: Record<string, unknown>, message: string): void;

  info(message: string): void;
  info(meta: Record<string, unknown>, message: string): void;

  warn(message: string): void;
  warn(meta: Record<string, unknown>, message: string): void;

  error(message: string): void;
  error(meta: Record<string, unknown>, message: string): void;

  child(meta: Record<string, unknown>): Logger;
}
