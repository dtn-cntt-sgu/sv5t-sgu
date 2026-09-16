import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/require-user";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function apiError(
  error: unknown,
  context?: { requestId: string; stage: string; operation?: string },
) {
  if (context) {
    const failure = error && typeof error === "object" ? error : {};
    // Do not log database details (which can contain complete rows), credentials or signed URLs.
    console.error(`[${context.operation ?? "UPLOAD"}] failed`, {
      ...context,
      code: "code" in failure ? failure.code : "UNEXPECTED",
      message: "message" in failure ? String(failure.message) : "Unknown error",
    });
  }
  if (
    context?.operation &&
    ["SUBMIT", "REVIEW", "STATISTICS"].includes(context.operation) &&
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "PGRST202"
  ) {
    return NextResponse.json(
      {
        error: {
          code: `${context.operation}_RPC_UNAVAILABLE`,
          message:
            "Chức năng chưa sẵn sàng. Vui lòng báo quản trị viên cập nhật cơ sở dữ liệu.",
          requestId: context.requestId,
        },
      },
      { status: 503 },
    );
  }
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: { code: "AUTH_ERROR", message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu không hợp lệ.",
          details: error.issues,
        },
      },
      { status: 422 },
    );
  }
  const code =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const messages: Record<string, string> = {
    APPLICATION_NOT_FOUND: "Không tìm thấy hồ sơ của bạn.",
    PROFILE_INCOMPLETE:
      "Vui lòng bổ sung mã số sinh viên và khoa trước khi tải file.",
    FILE_NOT_ALLOWED_FOR_APPLICATION:
      "Loại minh chứng không phù hợp với hồ sơ.",
    CAMPAIGN_MUST_BE_CLOSED:
      "Đợt xét phải đóng và hết thời gian nhận hồ sơ trước khi xuất lưu trữ.",
    CAMPAIGN_LOCKED_FOR_EXPORT:
      "Đợt xét đã khóa để xuất lưu trữ; không thể thay đổi hồ sơ.",
    READY_EXPORT_REQUIRED:
      "Cần đóng đợt và xuất thành công toàn bộ hồ sơ trước khi xóa.",
    OTP_INVALID: "Mã xác thực không đúng, hết hạn hoặc đã sử dụng.",
    OTP_RATE_LIMIT: "Vui lòng chờ 60 giây trước khi yêu cầu mã mới.",
    CAMPAIGN_NOT_OPEN: "Đợt xét duyệt chưa mở hoặc đã hết hạn.",
    UPLOAD_NOT_ALLOWED: "Hồ sơ hiện không cho phép tải minh chứng.",
    FILE_NOT_REQUESTED: "Bạn chỉ được thay file có yêu cầu nộp lại.",
    UPLOAD_IN_PROGRESS:
      "Có lượt tải đang xử lý. Vui lòng hoàn tất hoặc thử lại sau 6 phút.",
    REQUIRED_FILES_MISSING:
      "Vui lòng hoàn tất đầy đủ minh chứng trước khi gửi.",
    INVALID_APPLICATION_TRANSITION:
      "Trạng thái hồ sơ đã thay đổi. Vui lòng tải lại trang.",
    STORAGE_HARD_LIMIT_REACHED:
      "Dung lượng lưu trữ đã đầy. Vui lòng liên hệ Hội Sinh viên.",
    UPLOAD_RESERVATION_INVALID:
      "Lượt tải đã hết hạn. Vui lòng chọn file và thử lại.",
    UPLOADED_OBJECT_MISMATCH:
      "File tải lên không khớp. Vui lòng kiểm tra và thử lại.",
    FILE_TOO_LARGE: "File vượt dung lượng cho phép.",
    UNSUPPORTED_FILE_TYPE: "Định dạng file không được hỗ trợ.",
    REVIEW_NOT_ALLOWED: "Hồ sơ chưa sẵn sàng xét duyệt hoặc đã có kết quả.",
    REVIEWER_NOT_ALLOWED: "Tài khoản không có quyền xét duyệt hồ sơ.",
    CROSS_FACULTY_REVIEW_DENIED:
      "Bạn chỉ được xét duyệt hồ sơ thuộc khoa của mình.",
    FILE_NOT_FOUND:
      "Không tìm thấy minh chứng thuộc hồ sơ. Vui lòng tải lại trang.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    REVIEW_NOTE_REQUIRED: "Vui lòng nhập lý do ít nhất 5 ký tự.",
  };
  if (messages[code])
    return NextResponse.json(
      { error: { code, message: messages[code] } },
      { status: 409 },
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return NextResponse.json(
      {
        error: {
          code: "DUPLICATE",
          message: "Thông tin này đã tồn tại. Vui lòng kiểm tra lại.",
        },
      },
      { status: 409 },
    );
  console.error(
    "API failure",
    error && typeof error === "object" && "code" in error
      ? error.code
      : "UNEXPECTED",
  );
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Hệ thống đang bận. Vui lòng thử lại.",
        ...(context ? { requestId: context.requestId } : {}),
      },
    },
    { status: 500 },
  );
}
