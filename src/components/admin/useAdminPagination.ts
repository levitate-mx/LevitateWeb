import { useEffect, useState } from "react";

export const ADMIN_PAGE_SIZES = [10, 25, 50] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number];

type PaginationState = {
  page: number;
  pageSize: AdminPageSize;
  filterKey: string;
};

export function resolveAdminPagination(state: PaginationState, totalItems: number, filterKey: string) {
  const pageCount = Math.max(1, Math.ceil(totalItems / state.pageSize));
  const page = state.filterKey === filterKey ? Math.max(1, Math.min(state.page, pageCount)) : 1;
  const startIndex = (page - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalItems);

  return {
    page,
    pageSize: state.pageSize,
    pageCount,
    totalItems,
    startIndex,
    endIndex,
    firstItem: totalItems === 0 ? 0 : startIndex + 1,
    lastItem: endIndex,
  };
}

export function useAdminPagination<T>(items: T[], filterKey: string) {
  const [state, setState] = useState<PaginationState>({ page: 1, pageSize: 10, filterKey });
  const pagination = resolveAdminPagination(state, items.length, filterKey);
  const { page, pageCount } = pagination;

  useEffect(() => {
    setState((current) => current.filterKey === filterKey && current.page === page
      ? current
      : { ...current, filterKey, page });
  }, [filterKey, page]);

  const onPageChange = (nextPage: number) => {
    setState((current) => ({ ...current, filterKey, page: Math.max(1, Math.min(nextPage, pageCount)) }));
  };

  const onPageSizeChange = (pageSize: AdminPageSize) => {
    setState({ filterKey, page: 1, pageSize });
  };

  return {
    ...pagination,
    visibleItems: items.slice(pagination.startIndex, pagination.endIndex),
    onPageChange,
    onPageSizeChange,
  };
}
