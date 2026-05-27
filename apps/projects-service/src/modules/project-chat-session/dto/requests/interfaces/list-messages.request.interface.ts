// `before` cursor is the `seq` of the oldest message returned in the previous
// page. The BE returns rows where `seq < before` (DESC), so passing the last
// row's `seq` advances the cursor cleanly.
export interface IListMessagesRequest {
  before?: number;
  limit?: number;
}
