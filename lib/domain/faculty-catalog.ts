export type Faculty = {
  id: string;
  code: string;
  name: string;
  majors: Array<{ id: string; code: string; name: string }>;
};
export function isFacultyCatalog(value: unknown): value is Faculty[] {
  if (!Array.isArray(value) || !value.length) return false;
  const record = (
    item: unknown,
  ): item is { id: string; code: string; name: string } => {
    if (!item || typeof item !== "object") return false;
    const fields = item as Record<string, unknown>;
    return (
      typeof fields.id === "string" &&
      !!fields.id &&
      typeof fields.code === "string" &&
      typeof fields.name === "string" &&
      !!fields.name
    );
  };
  return value.every(
    (f) =>
      record(f) &&
      Array.isArray((f as Faculty).majors) &&
      (f as Faculty).majors.every(record),
  );
}
