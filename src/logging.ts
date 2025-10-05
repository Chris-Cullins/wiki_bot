export class DebugLogger {
  constructor(private readonly enabled: boolean) {}

  debug(message: string, ...details: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    if (details.length === 0) {
      console.log(`⚙️  ${message}`);
    } else {
      console.log(`⚙️  ${message}`, ...details);
    }
  }
}
