/**
 * Multipart fields accepted alongside the binary `file` part.
 * The file itself flows in via `req.file()`, not through the DTO.
 */
export interface IUploadFileRequest {
  /** Optional caller-supplied tag (`avatar`, `project_attachment`, …). */
  readonly purpose?: string;
}
