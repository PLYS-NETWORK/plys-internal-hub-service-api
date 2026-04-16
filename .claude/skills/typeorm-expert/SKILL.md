# TypeORM Expert

Use when creating entities or repositories.

Rules:

- Use explicit relations
- Prefer query builder for complex queries
- Use transactions for multi-step operations

Entity example:

@Entity({ name: "users" })
export class User {

  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @CreateDateColumn()
  created_at: Date;
}