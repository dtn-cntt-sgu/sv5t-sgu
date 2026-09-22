"use client";
import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import {
  formatCampaignDate,
  parseCampaignDate,
} from "@/lib/domain/campaign-date";
import styles from "./campaign-date-input.module.css";

export function CampaignDateInput({
  name,
  value,
}: {
  name: string;
  value?: string;
}) {
  const text = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const local = (iso?: string) =>
    iso
      ? new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16)
      : "";
  return (
    <span className={styles.field}>
      <input
        ref={text}
        type="text"
        name={name}
        required
        placeholder="dd/mm/yyyy HH:MM"
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}"
        maxLength={16}
        title="Ngày/tháng/năm giờ:phút, ví dụ 25/09/2026 08:30"
        defaultValue={formatCampaignDate(value)}
        onChange={(event) => {
          if (!picker.current) return;
          try {
            picker.current.value = local(parseCampaignDate(event.target.value));
          } catch {
            picker.current.value = "";
          }
        }}
      />
      <span className={styles.calendar}>
        <CalendarDays size={20} aria-hidden="true" />
        <input
          ref={picker}
          type="datetime-local"
          aria-label={
            name === "start_date"
              ? "Chọn lịch mở nhận hồ sơ"
              : "Chọn lịch đóng nhận hồ sơ"
          }
          defaultValue={local(value)}
          step={60}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker?.();
            } catch {
              /* Native input remains usable. */
            }
          }}
          onChange={(event) => {
            if (text.current)
              text.current.value = event.target.value
                ? formatCampaignDate(`${event.target.value}:00+07:00`)
                : "";
          }}
        />
      </span>
    </span>
  );
}
