import { AuthError } from "./require-user";
export function requireDesktopUpload(request: Request) {
  if (
    /Android|iPhone|iPad|iPod|Mobile/i.test(
      request.headers.get("user-agent") ?? "",
    )
  )
    throw new AuthError("Vui lòng sử dụng máy tính để tải minh chứng.", 403);
}
