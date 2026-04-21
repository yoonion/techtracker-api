import {
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { BlogSource } from '../blog-source/blog-source.entity';

@Entity()
@Index(['user', 'source'], { unique: true })
export class BlogSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => BlogSource, { onDelete: 'CASCADE' })
  source: BlogSource;

  @CreateDateColumn()
  createdAt: Date;
}

