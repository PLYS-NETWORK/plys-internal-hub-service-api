import { OpenAPIObject } from '@nestjs/swagger';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

type PathItem = NonNullable<OpenAPIObject['paths']>[string];

interface Operation {
  tags?: string[];
}

// ── Tag sets ──────────────────────────────────────────────────────────────────

const SHARED_TAGS = ['Auth', 'Skills', 'Payments'] as const;

const BUSINESS_TAGS = [
  'Business Profiles',
  'Business Projects — Main',
  'Business Projects — Overview',
  'Business Projects — Backlogs',
  'Business Projects — Settings',
  'Business Projects — Applications',
  'Business Projects — Board',
  'Applications - Business',
  'Business Payments',
] as const;

const CONSULTANT_TAGS = [
  'Consultant Profiles',
  'Projects - Consultant',
  'Tasks - Consultant',
  'Applications - Consultant',
  'Consultant Payments',
] as const;

const ADMIN_TAGS = ['Admin - Billing'] as const;

export const BUSINESS_DOC_TAGS: readonly string[] = [...SHARED_TAGS, ...BUSINESS_TAGS];
export const CONSULTANT_DOC_TAGS: readonly string[] = [...SHARED_TAGS, ...CONSULTANT_TAGS];
export const ADMIN_DOC_TAGS: readonly string[] = ['Auth', ...ADMIN_TAGS];

// ── Filter ────────────────────────────────────────────────────────────────────

/**
 * Returns a new OpenAPIObject containing only paths whose operations carry at
 * least one tag from `allowedTags`. `components` (schema definitions) is kept
 * whole — pruning unused $refs is unnecessary for dev-only Swagger UI.
 */
export function filterDocumentByTags(
  document: OpenAPIObject,
  allowedTags: readonly string[],
  title: string,
): OpenAPIObject {
  const tagSet = new Set(allowedTags);
  const filteredPaths: OpenAPIObject['paths'] = {};

  for (const [path, rawItem] of Object.entries(document.paths)) {
    if (!rawItem) continue;

    const filteredItem: Partial<Record<(typeof HTTP_METHODS)[number], Operation>> = {};

    for (const method of HTTP_METHODS) {
      const op = (rawItem as Record<string, unknown>)[method] as Operation | undefined;
      if (op?.tags?.some((t) => tagSet.has(t))) {
        filteredItem[method] = op;
      }
    }

    if (Object.keys(filteredItem).length > 0) {
      filteredPaths[path] = filteredItem as PathItem;
    }
  }

  return {
    ...document,
    info: { ...document.info, title },
    paths: filteredPaths,
    tags: (document.tags ?? []).filter((t) => tagSet.has(t.name)),
  };
}
