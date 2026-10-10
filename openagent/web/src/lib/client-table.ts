// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import type {CasdoorListResponse, TableQuery} from "@/components/crud/types";

/** Applies a table's search, sort and paging to rows that are all in memory. */
export function queryRows<T extends Record<string, any>>(allRows: T[], query: TableQuery): {rows: T[]; total: number} {
  let rows = [...allRows];
  if (query.searchedColumn && query.searchText) {
    const needle = query.searchText.toLowerCase();
    rows = rows.filter((row) => String(row[query.searchedColumn] ?? "").toLowerCase().includes(needle));
  }
  if (query.sortField && query.sortOrder) {
    const direction = query.sortOrder === "ascend" ? 1 : -1;
    rows.sort((a, b) => {
      const x = a[query.sortField];
      const y = b[query.sortField];
      if (typeof x === "number" && typeof y === "number") {
        return (x - y) * direction;
      }
      return String(x ?? "").localeCompare(String(y ?? "")) * direction;
    });
  }

  const start = (query.page - 1) * query.pageSize;
  return {rows: rows.slice(start, start + query.pageSize), total: rows.length};
}

/**
 * For the list APIs that return every row at once (pipes, sites...): applies the
 * search, sort and paging of the table on the client, so these lists behave like
 * the server-paged ones.
 */
export async function clientPaged<T extends Record<string, any>>(
  request: Promise<CasdoorListResponse<T>>,
  query: TableQuery,
): Promise<CasdoorListResponse<T>> {
  const res = await request;
  if (res?.status !== "ok") {
    return res;
  }

  const {rows, total} = queryRows(res.data ?? [], query);
  return {...res, data: rows, data2: total};
}
