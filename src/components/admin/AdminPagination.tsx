import { ADMIN_PAGE_SIZES, type AdminPageSize } from "./useAdminPagination";

type AdminPaginationProps = {
  firstItem: number;
  lastItem: number;
  totalItems: number;
  page: number;
  pageCount: number;
  pageSize: AdminPageSize;
  label: string;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: AdminPageSize) => void;
};

export function AdminPagination({
  firstItem,
  lastItem,
  totalItems,
  page,
  pageCount,
  pageSize,
  label,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: AdminPaginationProps) {
  return (
    <footer className="registration-admin-table-footer registration-admin-pagination">
      <span aria-live="polite" aria-atomic="true">
        Mostrando {firstItem} a {lastItem} de {totalItems} {itemLabel}
      </span>
      <label className="registration-admin-pagination__size">
        Por página
        <select onChange={(event) => onPageSizeChange(Number(event.target.value) as AdminPageSize)} value={pageSize}>
          {ADMIN_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <nav aria-label={`Paginación de ${label}`}>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">Anterior</button>
        <span>Página {page} de {pageCount}</span>
        <button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button">Siguiente</button>
      </nav>
    </footer>
  );
}
