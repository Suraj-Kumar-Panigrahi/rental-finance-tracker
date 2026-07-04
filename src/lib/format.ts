export const todayISO = () => new Date().toISOString().slice(0, 10);

export const currentMonthISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

export const toMonthInputValue = (isoDate: string) => isoDate.slice(0, 7);

export const fromMonthInputValue = (month: string) => `${month}-01`;

export const money = (value: number | null | undefined) =>
  new Intl.NumberFormat(undefined, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const dateLabel = (date: string | null | undefined) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(`${date}T00:00:00`));
};

export const monthLabel = (date: string | null | undefined) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(new Date(`${date.slice(0, 10)}T00:00:00`));
};
