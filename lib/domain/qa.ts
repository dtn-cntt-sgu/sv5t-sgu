export type Faq = {
  id: string;
  question: string;
  answer: string;
  version: number;
  position: number;
};
export type PrivateQuestion = {
  id: string;
  student_name: string;
  student_code: string | null;
  question: string;
  answer: string | null;
  answered_name: string | null;
  created_at: string;
  answered_at: string | null;
};
export type QaPage = {
  faqs: Faq[];
  questions: PrivateQuestion[];
  total: number;
  pending: boolean;
  waiting: number;
};
