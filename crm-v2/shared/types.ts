export type { UserRole, LeadStatus, LeadOrigem, Temperatura } from "./const";

export type ApiError = {
  code: string;
  message: string;
};

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PaginationInput = {
  page?: number;
  limit?: number;
};

export type DateRangeInput = {
  inicio?: string;
  fim?: string;
};
