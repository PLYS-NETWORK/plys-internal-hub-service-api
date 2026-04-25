export interface ITopUpResponse {
  /** UUID of the pending top-up transaction record created for this operation. */
  transaction_id: string;
  /** Payment provider URL the client must redirect the user to in order to complete the top-up. */
  redirect_url: string;
}
