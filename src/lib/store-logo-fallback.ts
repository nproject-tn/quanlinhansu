type ErrorWithMessage = {
  message?: string;
  code?: string;
  name?: string;
};

export function isMissingStoreLogoColumn(error: unknown) {
  const candidate = error as ErrorWithMessage | undefined;
  const message = candidate?.message?.toLowerCase() ?? "";
  const code = candidate?.code?.toLowerCase() ?? "";
  const name = candidate?.name?.toLowerCase() ?? "";

  return (
    message.includes("logourl") &&
    (message.includes("does not exist") ||
      message.includes("unknown field") ||
      message.includes("unknown argument") ||
      message.includes("column") ||
      message.includes("argument") ||
      code === "p2022" ||
      name.includes("prismaclientvalidationerror"))
  );
}

export async function retryStoreMutationWithoutLogo<T>(
  hasLogoUrl: boolean,
  mutate: () => Promise<T>,
  mutateWithoutLogo: () => Promise<T>
) {
  try {
    return { result: await mutate(), logoPendingMigration: false };
  } catch (error) {
    if (!hasLogoUrl || !isMissingStoreLogoColumn(error)) {
      throw error;
    }

    return {
      result: await mutateWithoutLogo(),
      logoPendingMigration: true,
    };
  }
}
