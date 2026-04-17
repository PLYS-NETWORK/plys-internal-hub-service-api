# Rule: Database Integrity, Performance & Naming

## Explicit Naming Convention (Mandatory)
Do NOT let TypeORM generate random hashes for constraints. All names must be human-readable and follow this schema:

- **Primary Key:** `pk_table_name` (e.g., `pk_users`)
- **Foreign Key:** `fk_table_source_to_table_target` (e.g., `fk_orders_to_users`)
- **Unique Index:** `uq_table_column` (e.g., `uq_users_email`)
- **General Index:** `idx_table_column` (e.g., `idx_products_status`)
- **Compound Index:** `idx_table_col1_col2`

### Code Example:
@Entity('products')
@Index('idx_products_slug_status', ['slug', 'status']) // Explicit name
export class Product {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'pk_products' })
  id: number;

  @Column({ unique: true, uniqueConstraintName: 'uq_products_sku' })
  sku: string;

  @ManyToOne(() => Category)
  @JoinColumn({ 
    name: 'category_id', 
    foreignKeyConstraintName: 'fk_products_to_categories' 
  })
  category: Category;
}

## Transaction Management
- **Mandatory:** Use `DataSource.transaction()` for multi-step operations (e.g., Order Creation + Inventory Deduction).
- **Race Conditions:** Use `setLock("pessimistic_write")` for inventory and balance updates.

## Performance Standards
- **N+1 Prevention:** Never call a Repository method inside a loop. Use `leftJoinAndSelect`.
- **Marketplace Indexing:** - Always index `coupon_code` in the Coupons table: `idx_coupons_code`.
    - Use Functional Indexes (e.g., `LOWER(email)`) for case-insensitive logins.