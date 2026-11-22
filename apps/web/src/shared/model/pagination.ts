export const normalizePagination = ({ page = 1, pageSize = 20 }: { page?: number; pageSize?: number }) => ({
  page: Number.isFinite(page) ? Math.max(Math.trunc(page), 1) : 1,
  pageSize: Number.isFinite(pageSize) ? Math.min(Math.max(Math.trunc(pageSize), 1), 100) : 20
})
