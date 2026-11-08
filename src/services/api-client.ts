/** Phase 1 transport boundary. Replace this adapter with fetch + FastAPI in Phase 2. */
export async function mockRequest<T>(
  factory: () => T,
  delay = 650,
): Promise<T> {
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  return structuredClone(factory());
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
