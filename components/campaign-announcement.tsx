"use client";
import { useResource } from "@/lib/client/use-resource";
import { type Campaign, dateLabel } from "@/lib/domain/models";
export function CampaignAnnouncement({
  deadline = false,
}: {
  deadline?: boolean;
}) {
  const { data, loading, error } = useResource<Campaign | null>(
    "/public/campaigns/active",
  );
  if (deadline)
    return (
      <>
        <small>{data ? "Hạn nhận hồ sơ" : "Lịch nhận hồ sơ"}</small>
        <strong>
          {loading
            ? "Đang cập nhật…"
            : error
              ? "Xem thông báo đợt xét"
              : data
                ? dateLabel(data.end_date)
                : "Chưa mở đợt mới"}
        </strong>
      </>
    );
  return (
    <div className="eyebrow">
      <span />
      {data
        ? data.name
        : loading
          ? "Cổng Sinh viên 5 Tốt · SGU"
          : "Cổng Sinh viên 5 Tốt · Đại học Sài Gòn"}
    </div>
  );
}
