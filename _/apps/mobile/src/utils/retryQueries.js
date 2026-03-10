export async function invalidateMany(queryClient, queryKeys) {
  if (!queryClient || typeof queryClient.invalidateQueries !== "function") {
    return;
  }

  const keys = Array.isArray(queryKeys) ? queryKeys : [];
  const filtered = keys.filter(Boolean);

  try {
    await Promise.all(
      filtered.map((queryKey) =>
        queryClient.invalidateQueries({
          queryKey,
        }),
      ),
    );
  } catch (err) {
    // Retry should never crash the screen.
    console.error(err);
  }
}
