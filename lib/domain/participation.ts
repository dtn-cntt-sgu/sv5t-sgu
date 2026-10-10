export const PARTICIPATION_RESET_CONFIRMATION = "xacnhanresetdanhsachdangki";

export type ParticipationRegistration = {
  user_id: string;
  registered_at: string;
  mssv: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  class_name: string | null;
  faculty_id: string | null;
  faculty_name: string | null;
  major_name: string | null;
};

export type ParticipationRegistrationList = {
  registrations: ParticipationRegistration[];
  faculties: { id: string; name: string }[];
};
