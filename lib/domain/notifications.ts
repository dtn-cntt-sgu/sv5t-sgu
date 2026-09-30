export type StudentNotification = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  created_at: string;
  read_at: string | null;
};
export type NotificationPage = { items: StudentNotification[]; total: number };
