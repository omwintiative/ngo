/*
  Search used by the Blog page and the admin lists. Accents and case are
  ignored, so "omugwo" finds "Ọmụgwọ" and "adaeze" finds "Adaeze".
*/
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** True when `query` is empty or appears in any of the fields. */
export function matchesSearch(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = fold(query.trim());
  return !q || fold(fields.filter(Boolean).join(' ')).includes(q);
}
