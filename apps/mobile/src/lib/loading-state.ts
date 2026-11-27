// null and [] are successful values. Disabled queries are pending but not fetching.
export function isInitialLoading(query: {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
}) {
  return query.data === undefined && query.isPending && query.isFetching;
}
