# SV5T SGU

Website xét duyệt và quản lý danh hiệu **Sinh viên 5 Tốt**. Repository dùng một ứng dụng Next.js full-stack để dễ triển khai trên Vercel, Supabase cho Auth/Postgres/RLS và Cloudflare R2 private bucket cho minh chứng.

## Trạng thái hiện tại

Foundation đã có:

- UI thống nhất cho guest, sinh viên, manager và admin; dashboard sinh viên.
- Ba cổng đăng nhập `/login`, `/manager/login`, `/admin/login`, đăng ký sinh viên và callback xác thực email.
- Schema, constraints, indexes, trigger đồng bộ Auth, RLS theo khoa và state machine hồ sơ.
- Luồng upload an toàn `presign --> PUT R2 --> HEAD + confirm`, private object, URL 5 phút, key cố định và hard-stop dung lượng ở app-layer.
- API tạo/nộp hồ sơ, danh sách/chi tiết/xét duyệt theo khoa, thống kê và kiểm tra R2 usage.

## Chạy local

Yêu cầu Node.js 20.19+ và npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ứng dụng chạy tại `http://localhost:3000`. Kiểm tra toàn bộ trước khi push:

```bash
npm run check
```

## Cấu trúc source

```text
app/                         Route, page và REST API v1
components/                  UI dùng lại giữa các portal
lib/auth/                    Role, session và authorization
lib/config/                  Parse/validate environment
lib/r2/                      Private R2 client, key, presigned URL
lib/supabase/                Browser/server/admin clients
lib/validation/              Data contract Zod
supabase/migrations/         Schema, RLS, transaction/RPC
supabase/seed.sql            Seed
scripts/                     Script
config/                      Cấu hình dịch vụ (outside)
docs/                        Kiến trúc, API và kế hoạch
```

## Quy tắc kiến trúc

- Component UI không được import admin client hoặc R2 credential.
- Route Handler xác thực user trước, kiểm tra scope, rồi mới dùng Supabase secret key cho transaction cần thiết.
- Không tin `role`, `faculty_id`, file size hay MIME từ client; kiểm tra lại bằng profile/RPC/R2 `HEAD`.
- Hồ sơ mới luôn là `DRAFT`; chỉ chuyển `SUBMITTED` khi đủ file. File nộp lại chỉ chuyển `RESUBMITTED` sau khi tất cả file bị yêu cầu đã được thay.
- Manager khoa không bao giờ nhận dữ liệu khoa khác, kể cả khi tự sửa query/URL.
- Mọi thao tác nhạy cảm phải có audit snapshot; không cascade xóa audit theo tài khoản người thực hiện.

Xem [hướng dẫn thiết lập từng bước](docs/SETUP.md), [kiến trúc và quyết định kỹ thuật](docs/ARCHITECTURE.md), [hợp đồng API](docs/API.md), [kế hoạch triển khai/giao việc](docs/ROADMAP.md) và [hướng dẫn đóng góp](CONTRIBUTING.md).

## Xuất ZIP và giải phóng dung lượng

Tốt nhất sau mỗi đợt xét duyệt, nên xuất toàn bộ dữ liệu của đợt đó và xóa dữ liệu của nó trên R2 và Supabase (chỉ lưu thống kê). Vì dung lượng R2 giới hạn.
Tuy nhiên, có một vấn đề là mỗi khi xuất file zip thì phải lưu file zip đó trên R2 nên sẽ tốn thêm 1 phần dung lượng

--> Do vậy, mỗi lần xuất, vừa thực hiện thao tác xóa trên web và thực hiện (thủ công) cả thao tác xóa file zip đó trên R2

## Thông báo từ Chủ tịch đến sinh viên

Chạy `supabase/migrations/202609300020_student_notifications.sql` trong Supabase SQL Editor sau các migration hiện có (bao gồm `202609300019`). Migration tạo bảng thông báo, trạng thái đọc riêng, RPC có kiểm tra quyền và cấu hình Realtime.

- Chủ tịch (`SCHOOL_PRESIDENT`): vào **Thông báo sinh viên** (`/manager/notifications`). Bên trái soạn tiêu đề/nội dung và xem trước; bên phải xem lịch sử đã gửi, mới nhất trước. Chỉ tài khoản Chủ tịch đang hoạt động có quyền gửi.
- Nội dung chỉ là văn bản, hỗ trợ tiêu đề đoạn, in đậm, in nghiêng, danh sách và xuống dòng. Không xử lý HTML, ảnh hay tệp đính kèm. Giới hạn tiêu đề 160 ký tự, nội dung 10.000 ký tự.
- Sinh viên: vào **Thông báo** (`/dashboard/notifications`) hoặc nhấn chuông trên header. Chuông hiển thị số chưa đọc và rung liên tục khi còn thông báo chưa đọc; chế độ giảm chuyển động của thiết bị sẽ tắt hiệu ứng rung.
- Mở một thông báo mới đánh dấu thông báo đó đã đọc. Trạng thái được lưu theo tài khoản, đồng bộ giữa các tab/thiết bị bằng Realtime; tự cập nhật lại mỗi 30 giây và khi quay lại tab/kết nối mạng.
- Mọi sinh viên đang hoạt động sau khi đăng nhập đều xem được lịch sử thông báo, kể cả tài khoản tạo sau ngày gửi. Không gửi email/push ngoài ứng dụng.
- Gửi lại cùng một yêu cầu không tạo bản sao. Thao tác gửi được ghi audit trong cùng transaction.

Kiểm thử database cục bộ: `node --test scripts/tests/notifications.test.mjs`.

## Hỏi đáp giữa sinh viên và Chủ tịch

Chạy `supabase/migrations/202610010021_questions_and_answers.sql` trong Supabase SQL Editor sau các migration hiện có để kích hoạt chức năng.

- Sinh viên: **Hỏi đáp** (`/dashboard/qa`). Bên trái là câu hỏi chung dạng đóng/mở; bên phải gửi câu hỏi riêng và xem lịch sử trả lời.
- Chủ tịch (`SCHOOL_PRESIDENT`): **Hỏi đáp** (`/manager/qa`). Có thể thêm, sửa, xóa (có xác nhận) và đổi thứ tự câu hỏi chung bằng nút lên/xuống. Danh sách câu hỏi riêng có bộ lọc chờ trả lời/đã trả lời/tất cả và phân trang 20 câu.
- Mỗi sinh viên chỉ có tối đa một câu hỏi chưa được trả lời. Database kiểm tra giới hạn này bằng khóa transaction và unique index, kể cả khi gửi từ nhiều tab. Sau khi Chủ tịch trả lời, sinh viên có thể hỏi tiếp.
- Câu hỏi chung được chia sẻ cho sinh viên đã đăng nhập và Chủ tịch. Trao đổi cá nhân chỉ người hỏi và Chủ tịch được đọc; quản lý khoa và quản trị viên không được truy cập.
- Nội dung là văn bản thuần, giữ xuống dòng. Câu hỏi chung tối đa 240 ký tự, câu hỏi riêng 3.000 ký tự, câu trả lời 5.000 ký tự. Không hỗ trợ tệp đính kèm.
- Trang đang mở cập nhật qua Supabase Realtime, có đồng bộ lại mỗi 30 giây và khi quay lại tab/kết nối mạng. Không tự chuyển câu hỏi riêng thành câu hỏi chung.
- Các thao tác quản lý FAQ/trả lời đều có audit. Câu trả lời riêng sau khi gửi được giữ nguyên; gửi lại cùng yêu cầu không tạo thêm câu hỏi hoặc câu trả lời.

Kiểm thử database cục bộ: `node --test scripts/tests/qa.test.mjs`.
