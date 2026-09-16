import { LoaderCircle, AlertCircle, Inbox } from "lucide-react";
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  if (error)
    return (
      <div className="empty-state" role="alert">
        <AlertCircle />
        <h3>Chưa tải được dữ liệu</h3>
        <p>{error}</p>
        {retry && (
          <button className="button button-outline" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <div className="empty-state" role="status">
        <LoaderCircle className="spin" />
        <p>Đang tải dữ liệu của bạn…</p>
      </div>
    );
  return null;
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
