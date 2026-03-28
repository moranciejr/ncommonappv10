export function blockPairNotExistsClause({ viewerUserIdSql, otherUserIdColumnSql }) {
  return `
    NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (
        (ub.blocker_user_id = ${viewerUserIdSql} AND ub.blocked_user_id = ${otherUserIdColumnSql})
        OR
        (ub.blocker_user_id = ${otherUserIdColumnSql} AND ub.blocked_user_id = ${viewerUserIdSql})
      )
    )
  `;
}

export async function isBlockedPair(sql, userIdA, userIdB) {
  const rows = await sql(
    `SELECT 1 FROM user_blocks
     WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
        OR (blocker_user_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userIdA, userIdB]
  );
  return (rows?.length || 0) > 0;
}
