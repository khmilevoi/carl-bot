import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'summaries' })
export class Summary {
  @PrimaryColumn({ name: 'chat_id' })
  chatId!: number;

  @Column()
  summary!: string;
}
