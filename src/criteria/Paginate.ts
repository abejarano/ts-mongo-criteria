export type Paginate<T> = {
  nextPag: string | number | null;
  count: number;
  results: Array<T>;
};
