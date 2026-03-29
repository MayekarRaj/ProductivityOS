// Single hardcoded user for v1.
// Every table has user_id for future multi-user support.
// When we add auth (Phase 9+), replace this constant with session.user.id.
//
// UUID format: 8-4-4-4-12 hex digits. We use all-zeros with a trailing 1
// so it's instantly recognisable in DB queries and logs.
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
