import { z } from "zod";
import { apiError, created } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/config/env";

const schema = z.object({
  mssv: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{5,20}$/)
    .transform((value) => value.toUpperCase()),
  fullName: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{9,15}$/),
  password: z.string().min(10).max(72),
  facultyId: z.uuid(),
  majorId: z.uuid(),
  className: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((value) => value.toUpperCase()),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const supabase = await createClient();
    const env = getPublicEnv();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          mssv: input.mssv,
          full_name: input.fullName,
          phone: input.phone,
          faculty_id: input.facultyId,
          major_id: input.majorId,
          class_name: input.className,
        },
      },
    });
    if (error) throw error;
    return created({
      userId: data.user?.id,
      emailConfirmationRequired: !data.session,
    });
  } catch (error) {
    return apiError(error);
  }
}
