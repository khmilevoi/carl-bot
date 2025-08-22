export class ChatEntity {
  private _title: string | null;

  constructor(
    public readonly chatId: number,
    title?: string | null
  ) {
    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat id');
    }
    this._title = title ?? null;
  }

  get title(): string | null {
    return this._title;
  }

  rename(title?: string | null): void {
    this._title = title ?? null;
  }
}
