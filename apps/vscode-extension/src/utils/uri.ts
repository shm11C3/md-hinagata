export interface StringifiableUri {
  toString(): string;
}

export function toUriString(uri: StringifiableUri): string {
  return uri.toString();
}
