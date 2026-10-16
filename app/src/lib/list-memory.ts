// Every list remembers its last sort and filters (Brendan: "every sort/view/filter remembers the last pick").
// components/list-tools.tsx writes this cookie whenever a pick changes; a list page opened plain (no ?…) reads it and
// opens with those picks again. The search box is not remembered: a stale search hides people.

/** The cookie a list's picks are kept in, by its path ("/contacts" → "rx-list-contacts"). */
export const listCookie = (path: string) => "rx-list-" + path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-");

/** What gets remembered: everything in the address but the search text, as a query string. */
export const rememberable = (params: URLSearchParams) => {
  const keep = new URLSearchParams(params);
  keep.delete("q");
  keep.delete("page");
  return keep.toString();
};
