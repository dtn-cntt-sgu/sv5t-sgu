"use client";
import { useState, type FormEvent } from "react";
import { PortalShell } from "./portal-shell";
import { useResource } from "@/lib/client/use-resource";
import { ResourceState } from "./resource-state";
import { mutation } from "@/lib/client/api";
type Document = {
  id: string;
  title: string;
  description: string;
  category: string;
  external_url: string;
  is_published: boolean;
  sort_order: number;
};
export function DocumentManagement() {
  const resource = useResource<Document[]>("/admin/documents");
  const [editing, setEditing] = useState<Document | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError("");
    try {
      await mutation("/admin/documents", {
        ...(editing ? { id: editing.id } : {}),
        title: f.get("title"),
        description: f.get("description"),
        category: f.get("category"),
        external_url: f.get("external_url"),
        is_published: f.get("is_published") === "on",
        sort_order: Number(f.get("sort_order")),
      });
      await resource.reload();
      setEditing(null);
      form.reset();
      setMessage("Đã lưu tài liệu.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal="admin" title="Quản lý tài liệu">
      <ResourceState {...resource} retry={resource.reload} />
      <div className="admin-two-columns">
        <section className="panel">
          <h2>Tài liệu bổ sung</h2>
          <p>
            Tiêu chuẩn cấp Thành phố và mẫu cá nhân CNTT có sẵn trong hệ thống.
            Tại đây bạn có thể bổ sung tài liệu theo liên kết.
          </p>
          {resource.data?.map((d) => (
            <article className="campaign-row" key={d.id}>
              <div>
                <h3>{d.title}</h3>
                <p>
                  {d.is_published ? "Đã công bố" : "Chưa công bố"} ·{" "}
                  {d.category === "TEMPLATE"
                    ? "Sinh viên đăng nhập"
                    : "Công khai"}
                </p>
              </div>
              <button
                className="button button-outline"
                onClick={() => setEditing(d)}
              >
                Sửa
              </button>
            </article>
          ))}
        </section>
        <form
          key={editing?.id ?? "new"}
          className="panel workspace-form"
          onSubmit={save}
        >
          <h2>{editing ? "Sửa tài liệu" : "Thêm tài liệu"}</h2>
          <label>
            Tên tài liệu
            <input
              name="title"
              minLength={3}
              maxLength={200}
              defaultValue={editing?.title}
              required
            />
          </label>
          <label>
            Mô tả
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={editing?.description ?? ""}
            />
          </label>
          <label>
            Phân loại
            <select name="category" defaultValue={editing?.category ?? "GUIDE"}>
              <option value="CRITERIA">Tiêu chí công khai</option>
              <option value="GUIDE">Hướng dẫn công khai</option>
              <option value="TEMPLATE">Biểu mẫu sinh viên</option>
              <option value="NOTICE">Thông báo công khai</option>
            </select>
          </label>
          <label>
            Liên kết HTTPS
            <input
              type="url"
              name="external_url"
              defaultValue={editing?.external_url ?? ""}
              required
              placeholder="https://…"
            />
          </label>
          <label>
            Thứ tự
            <input
              name="sort_order"
              type="number"
              min="0"
              max="10000"
              defaultValue={editing?.sort_order ?? 0}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={editing?.is_published ?? false}
            />
            Công bố tài liệu
          </label>
          {message && (
            <p className="form-message success" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={pending}>
            Lưu tài liệu
          </button>
          {editing && (
            <button
              className="button button-outline"
              type="button"
              onClick={() => setEditing(null)}
            >
              Hủy sửa
            </button>
          )}
        </form>
      </div>
    </PortalShell>
  );
}
