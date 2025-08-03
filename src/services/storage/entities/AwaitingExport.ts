import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'awaiting_export' })
export class AwaitingExport {
  @PrimaryColumn({ name: 'chat_id' })
  chatId!: number;
}
