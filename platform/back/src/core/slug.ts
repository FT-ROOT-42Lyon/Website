// Lowercase ASCII slug. Strips accents, collapses runs of non-alphanumerics
// to single dashes, trims leading/trailing dashes. Empty input returns "".
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
