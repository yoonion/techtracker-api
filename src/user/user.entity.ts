import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Post } from '../post/post.entity';
import { UserRole } from './user-role.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  discordUserId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  discordUsername: string | null;

  @Column({ type: 'datetime', nullable: true })
  discordConnectedAt: Date | null;
}
