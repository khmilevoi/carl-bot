import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'chat_id' })
  chatId!: number;

  @Column()
  role!: 'user' | 'assistant';

  @Column()
  content!: string;

  @Column({ nullable: true })
  username?: string;

  @Column({ name: 'full_name', nullable: true })
  fullName?: string;

  @Column({ name: 'reply_text', nullable: true })
  replyText?: string;

  @Column({ name: 'reply_username', nullable: true })
  replyUsername?: string;

  @Column({ name: 'quote_text', nullable: true })
  quoteText?: string;
}
