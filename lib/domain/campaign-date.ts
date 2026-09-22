// Campaign schedules always use Vietnam time, independent of the browser timezone.
export function formatCampaignDate(value?: string) {
  if (!value) return "";
  const date = new Date(Date.parse(value) + 7 * 3600000);
  if (!Number.isFinite(date.getTime())) return "";
  const iso = date.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}
export function parseCampaignDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (!match)
    throw new Error("Vui lòng nhập ngày giờ theo định dạng dd/mm/yyyy HH:mm.");
  const [, day, month, year, hour, minute] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
  const date = new Date(iso);
  if (
    !Number.isFinite(date.getTime()) ||
    formatCampaignDate(iso) !== value.trim()
  )
    throw new Error(
      "Ngày giờ không hợp lệ. Vui lòng kiểm tra ngày, tháng và giờ đã nhập.",
    );
  return date.toISOString();
}
