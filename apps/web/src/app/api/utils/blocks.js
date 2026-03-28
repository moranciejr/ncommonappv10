/**
 * Returns a SQL clause that filters out blocked user pairs.
 * Usage: embed in a WHERE clause.
 */
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
