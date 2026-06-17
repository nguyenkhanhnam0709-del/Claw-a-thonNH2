# Zalopay Merchant Onboarding — Multi-Agent System

Hệ thống **3 AI Agent** hỗ trợ toàn bộ quy trình onboarding merchant mới cho giải pháp cổng thanh toán **ZaloPay**, xây dựng trên nền tảng **GreenNode AgentBase (VNG Cloud)**.

Mỗi agent đại diện cho một **vai trò (POV)** trong quy trình và phối hợp với nhau theo 4 giai đoạn:

| Phase | Giai đoạn | Phòng ban / PIC | Agent phụ trách |
|------:|-----------|-----------------|-----------------|
| 1 | Thẩm định Merchant | Compliance · KhoaNVM | Onboarding (gửi) → **Compliance Agent** (duyệt) |
| 2 | Review Hợp đồng | Legal · TuPNC | Onboarding (gửi) → **Legal Agent** (rà soát) |
| 3 | Tích hợp kỹ thuật | Tech · NhanNĐT | **Onboarding Agent** (tạo ticket Jira) |
| 4 | Tạo FA Code | Accounting · ChienNM | **Onboarding Agent** (gửi thông tin) |

**Luồng tổng thể:** BD dùng *Onboarding Agent* để chuẩn bị hồ sơ & gửi yêu cầu cho từng PIC → *Compliance Agent* duyệt hồ sơ Phase 1 → *Legal Agent* rà soát hợp đồng Phase 2 → BD tiếp tục Phase 3, 4 đến khi merchant go-live.

**Tech stack:** Node.js + TypeScript + Express · LLM MiniMax (qua VNG Cloud MaaS, OpenAI-compatible) · Docker · GreenNode AgentBase Runtime (endpoint public, autoscaling, memory).

```
.
├── new-merchant-onboarding-agent/   # POV: BD / Biz
├── compliance-agent/                # POV: Compliance
└── legal-agent/                     # POV: Legal
```

---

## 1. Merchant Onboarding Agent (`new-merchant-onboarding-agent`)

**POV: BD / Biz**

### • Agent giải quyết vấn đề gì?
Quy trình onboarding merchant trải qua 4 giai đoạn với nhiều phòng ban, mỗi phase cần đúng tài liệu và gửi đúng PIC. BD thường mất thời gian tra cứu quy trình, soạn email/ticket thủ công và dễ thiếu sót tài liệu. Agent này **tự động hoá và chuẩn hoá** toàn bộ thao tác đó cho BD.

### • Ai là người sử dụng?
Đội **Business Development (BD)** của ZaloPay — người trực tiếp onboarding merchant mới.

### • Agent hoạt động như thế nào?
- Giao diện chat (UI brand ZaloPay). LLM hiểu yêu cầu tiếng Việt và gọi đúng "tool":
  - `get_phases` / `get_phase_detail` — giải đáp quy trình & chi tiết từng giai đoạn.
  - `validate_documents` — đối chiếu tài liệu BD nộp với yêu cầu của phase (Đủ/Thiếu).
  - `generate_email` — tạo **và gửi email thật** (SMTP/Gmail) cho PIC ở Phase 1/2/4, **đính kèm tài liệu** BD upload và hỗ trợ **CC** cho người cần theo dõi.
  - `generate_ticket` — sinh ticket Jira cho Phase 3 (tích hợp kỹ thuật).
  - `lookup_tax_id` — tra cứu mã số thuế doanh nghiệp.
- Phản hồi theo bộ **Response Formats** chuẩn (danh sách phase, chi tiết phase, kết quả kiểm tra, xác nhận đã gửi…).
- Tài liệu/email mẫu được nạp từ cấu hình (template), dễ tuỳ biến.

### • Giá trị mang lại
- Giảm thời gian onboarding: tra cứu — soạn email — tạo ticket chỉ bằng 1 câu chat.
- Chuẩn hoá nội dung & đúng người nhận → ít sai sót, ít email qua lại.
- Đính kèm đúng tài liệu cần review ngay từ đầu, rút ngắn vòng phê duyệt.

---

## 2. Compliance Agent (`compliance-agent`)

**POV: Compliance**

### • Agent giải quyết vấn đề gì?
Phase 1 yêu cầu Compliance thẩm định hồ sơ pháp lý của merchant (giấy phép kinh doanh). Việc theo dõi hàng loạt hồ sơ chờ duyệt, ra quyết định và phản hồi BD dễ bị phân tán. Agent giúp Compliance **quản lý hàng đợi hồ sơ và ra quyết định Approve/Reject** một cách tập trung.

### • Ai là người sử dụng?
Đội **Compliance** (PIC: KhoaNVM) — người thẩm định và phê duyệt hồ sơ merchant ở Phase 1.

### • Agent hoạt động như thế nào?
- Nhận **request từ Biz** (merchant + tài liệu cần thẩm định) và đưa vào **hàng đợi chờ duyệt**.
- Compliance xem danh sách pending, xem tài liệu, rồi quyết định:
  - **Approve** (`/api/approve`) — phê duyệt, BD được phép sang Phase 2.
  - **Reject** (`/api/reject`) — từ chối **kèm lý do** và danh sách tài liệu cần bổ sung.
- Tự động **gửi email thông báo kết quả cho BD**.
- Cấu hình quy trình/tiêu chí nạp từ file Excel (`excel-loader`).

### • Giá trị mang lại
- Một nơi tập trung theo dõi mọi hồ sơ Phase 1 đang chờ.
- Quyết định minh bạch (luôn kèm lý do khi từ chối) → BD biết chính xác cần bổ sung gì.
- Khép vòng phản hồi tự động giữa Compliance ↔ BD.

---

## 3. Legal Contract Review Agent (`legal-agent`)

**POV: Legal**

### • Agent giải quyết vấn đề gì?
Phase 2 yêu cầu Legal rà soát draft hợp đồng dịch vụ và các điều khoản điều chỉnh từ phía merchant. Rà soát thủ công tốn thời gian và dễ bỏ sót điều khoản. Agent hỗ trợ Legal **rà soát theo checklist và ra quyết định pháp lý** nhất quán.

### • Ai là người sử dụng?
Đội **Legal** (PIC: TuPNC) — người rà soát và phê duyệt hợp đồng dịch vụ merchant ở Phase 2.

### • Agent hoạt động như thế nào?
- Nhận **draft hợp đồng từ BD** (sau khi Compliance đã duyệt Phase 1).
- Rà soát các điều khoản theo **Legal Checklist** (thông tin pháp nhân, thẩm quyền ký, phí & thanh toán, trách nhiệm, bảo mật, chấm dứt, giải quyết tranh chấp theo luật Việt Nam…).
- Ra một trong ba quyết định, kèm lý do cụ thể:
  - **APPROVE** — hợp đồng đạt chuẩn, BD có thể ký kết / sang Phase 3.
  - **REJECT** — từ chối (điều khoản trái luật, sai thẩm quyền…).
  - **REQUEST_REVISION** — yêu cầu chỉnh sửa, liệt kê cụ thể điều khoản cần sửa.
- Theo dõi trạng thái hợp đồng (PENDING / APPROVED / REJECTED / REVISION_REQUESTED) và **thông báo cho BD**.

### • Giá trị mang lại
- Rà soát hợp đồng theo bộ tiêu chí chuẩn → giảm rủi ro pháp lý, ít bỏ sót.
- Phản hồi rõ ràng (approve/reject/sửa) giúp BD & merchant xử lý nhanh.
- Rút ngắn thời gian từ draft hợp đồng đến khi ký kết.

---

## Chạy local (mỗi agent)

```bash
cd <agent-folder>
cp .env.example .env      # điền LLM_API_KEY, SMTP_USER/SMTP_PASS...
npm install
npm run build             # tsc -> dist/
npm start                 # http://localhost:8080
```

> **Bảo mật:** `.env` (API key, mật khẩu email) và `.greennode.json` (IAM credentials) **không** được commit — xem `.gitignore`. Chỉ `.env.example` được theo dõi.

## Triển khai

Các agent được đóng gói Docker và deploy lên **GreenNode AgentBase Runtime** (endpoint public, health check `/health`, port 8080). Biến môi trường được inject lúc runtime; nền tảng tự cấp `GREENNODE_*` cho memory/identity.
