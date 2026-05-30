import path from "node:path";
import { fileURLToPath } from "node:url";

export interface StringifiableUri {
  toString(): string;
}

export function toUriString(uri: StringifiableUri): string {
  return uri.toString();
}

/**
 * Returns the directory that contains a `file:` URI, or `undefined` for
 * non-file URIs (for example `untitled:` documents) and unparseable input.
 *
 * Theme discovery walks up from this directory, so documents backed by a real
 * file on disk can resolve workspace themes that live in a parent folder, even
 * when the opened workspace root is an ancestor of the document.
 */
export function getFileUriDirectory(
  uri: string | undefined,
): string | undefined {
  if (uri === undefined || uri.length === 0) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "file:") {
    return undefined;
  }

  try {
    return path.dirname(fileURLToPath(parsed));
  } catch {
    return undefined;
  }
}
