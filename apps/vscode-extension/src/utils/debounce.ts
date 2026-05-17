export function debounce<TArgs extends readonly unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): (...args: TArgs) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return (...args: TArgs): void => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => callback(...args), delayMs);
  };
}
