import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminPagination } from "../src/components/admin/useAdminPagination.ts";

test("all filtered rows are reachable exactly once with each supported page size", () => {
  const rows = Array.from({ length: 63 }, (_, index) => index + 1);

  for (const pageSize of [10, 25, 50]) {
    const visited = [];
    const firstPage = resolveAdminPagination({ page: 1, pageSize, filterKey: "all" }, rows.length, "all");
    for (let page = 1; page <= firstPage.pageCount; page += 1) {
      const result = resolveAdminPagination({ page, pageSize, filterKey: "all" }, rows.length, "all");
      visited.push(...rows.slice(result.startIndex, result.endIndex));
      assert.equal(result.firstItem, visited.length - (result.endIndex - result.startIndex) + 1);
      assert.equal(result.lastItem, visited.length);
    }
    assert.deepEqual(visited, rows);
  }
});

test("a changed filter starts at the first page even when it returns the same number of rows", () => {
  const result = resolveAdminPagination({ page: 3, pageSize: 10, filterKey: "paid" }, 42, "pending");
  assert.equal(result.page, 1);
  assert.equal(result.firstItem, 1);
  assert.equal(result.lastItem, 10);
});

test("deleting the only row on the last page moves to the preceding page", () => {
  const state = { page: 3, pageSize: 10, filterKey: "all" };
  assert.equal(resolveAdminPagination(state, 21, "all").firstItem, 21);
  const result = resolveAdminPagination(state, 20, "all");
  assert.equal(result.page, 2);
  assert.equal(result.firstItem, 11);
  assert.equal(result.lastItem, 20);
});

test("zero results produce an empty range and valid first page", () => {
  const result = resolveAdminPagination({ page: 5, pageSize: 25, filterKey: "all" }, 0, "all");
  assert.equal(result.page, 1);
  assert.equal(result.pageCount, 1);
  assert.equal(result.firstItem, 0);
  assert.equal(result.lastItem, 0);
});

test("refreshing unchanged filters preserves the current page", () => {
  const result = resolveAdminPagination({ page: 2, pageSize: 25, filterKey: "reported" }, 62, "reported");
  assert.equal(result.page, 2);
  assert.equal(result.firstItem, 26);
  assert.equal(result.lastItem, 50);
});
