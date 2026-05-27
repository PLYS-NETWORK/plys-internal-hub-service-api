/**
 * Owner snapshot embedded in admin transaction responses so admins can
 * identify whose ledger row they are looking at without a second lookup.
 */
export interface IAdminTransactionOwnerResponse {
  /** UUID of the consultant or business profile that owns the transaction. */
  id: string;
  /** UUID of the user account behind that profile. */
  user_id: string;
  /** Display name (consultant `full_name` or business `company_name`). */
  name: string;
  /** Account email of the owning user. */
  email: string;
}
