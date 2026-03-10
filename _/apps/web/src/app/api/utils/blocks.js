export function blockPairNotExistsClause({
  viewerUserIdSql,
  otherUserIdColumnSql,
  blocksTableSql = "public.user_blocks",
}) {
  const viewerParam =
    typeof viewerUserIdSql === "string" ? viewerUserIdSql : "";
  const otherCol =
    typeof otherUserIdColumnSql === "string" ? otherUserIdColumnSql : "";

  // This helper only supports positional params (e.g. "$1") for the viewer id
  // and a *column reference* string for the other user id.
  if (!viewerParam.startsWith("$")) {
    throw new Error(
      "blockPairNotExistsClause requires viewerUserIdSql like '$1'",
    );
  }
  if (!otherCol) {
    throw new Error(
      "blockPairNotExistsClause requires otherUserIdColumnSql like 'u.id'",
    );
  }

  // NOTE: `otherUserIdColumnSql` must be a trusted column reference from our code.
  // Do not pass user input into this.
  return `NOT EXISTS (
    SELECT 1
    FROM ${blocksTableSql} b
    WHERE (b.blocker_user_id = ${viewerParam} AND b.blocked_user_id = ${otherCol})
       OR (b.blocker_user_id = ${otherCol} AND b.blocked_user_id = ${viewerParam})
  )`;
}

export async function isBlockedPair(sqlClient, userA, userB) {
  const a =
    typeof userA === "number" ? userA : parseInt(String(userA || ""), 10);
  const b =
    typeof userB === "number" ? userB : parseInt(String(userB || ""), 10);

  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b) || b <= 0) {
    return false;
  }

  const rows = await sqlClient(
    `
    SELECT 1
    FROM public.user_blocks
    WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
       OR (blocker_user_id = $2 AND blocked_user_id = $1)
    LIMIT 1
    `,
    [a, b],
  );

  return !!rows?.length;
}
