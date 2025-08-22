export class UserEntity {
  private _attitude: string | null;

  constructor(
    public readonly id: number,
    public username?: string | null,
    public firstName?: string | null,
    public lastName?: string | null,
    attitude?: string | null
  ) {
    if (!Number.isInteger(id) || id < 0) {
      throw new Error('Invalid user id');
    }
    this._attitude = attitude?.trim() ?? null;
  }

  get attitude(): string | null {
    return this._attitude;
  }

  setAttitude(attitude: string): void {
    const trimmed = attitude.trim();
    if (trimmed === '') {
      throw new Error('Attitude cannot be empty');
    }
    this._attitude = trimmed;
  }
}
