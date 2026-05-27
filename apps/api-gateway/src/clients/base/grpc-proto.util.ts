import * as fs from 'node:fs';

/** Returns the first candidate path list whose files all exist on disk. */
export function resolveProtoPaths(candidates: readonly (readonly string[])[]): readonly string[] {
  for (const paths of candidates) {
    if (paths.every((candidate) => fs.existsSync(candidate))) {
      return paths;
    }
  }
  return candidates[0];
}
