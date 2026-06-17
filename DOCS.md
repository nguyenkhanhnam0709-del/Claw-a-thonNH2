# Zalopay Multi-Agent System — Tài liệu chi tiết

**mini-ERP chuẩn hóa quy trình vận hành.** Nền tảng AI multi-agent giúp standardize, tracking và tự động hóa các quy trình đa phòng ban (cross-function) tại Zalopay: Business, Compliance, Legal, FP&A, Operations và các bộ phận liên quan.

**Mục tiêu:** chuẩn hóa quy trình · giảm rủi ro vận hành · nâng cao hiệu suất · theo dõi tiến độ minh bạch.

**Roadmap:** 3 demo agent (use case: onboard 1 đối tác) tương ứng 3 function. Orchestrator & central dashboard đang trong roadmap.

---

## 1. Painpoints

- **Quy trình cross-functional phức tạp:** nhiều bước qua nhiều phòng ban; nhân sự mới khó nhớ trình tự các bước, hồ sơ cần chuẩn bị, PIC từng giai đoạn; phụ thuộc "truyền miệng" / "cầm tay chỉ việc".
- **Thiếu chuẩn hóa:** quy trình nhiều layer, mỗi team diễn giải và thực thi khác nhau → dễ sai lệch (mismatch); khó cập nhật đồng bộ khi policy/regulation thay đổi.
- **Communication phân mảnh:** mỗi function dùng kênh khác nhau (email, chat, ticket, file-sharing) → request dễ bị miss, không có single source of truth, executive khó follow tiến độ tổng thể.

## 2. Giải pháp: Multi-Agent System

Hệ thống gồm nhiều AI agent chuyên biệt, mỗi agent được "nhúng" kiến thức và quy trình chuẩn của từng function, phối hợp theo workflow tiêu chuẩn. **3 mục tiêu cốt lõi:**

- **Chuẩn hóa & nhất quán** — quy trình "đúng" được hệ thống hóa, dùng 24/7; cập nhật tập trung khi policy thay đổi.
- **Tăng khả năng quản lý tổng thể** — dashboard tập trung theo dõi tiến độ xuyên suốt tổ chức.
- **Giảm rủi ro vận hành** — hạn chế sai sót, giảm request bị miss, giảm phụ thuộc cá nhân.

## 3. Demo Use Case: Onboarding Merchant mới

| Agent | Vai trò | Output |
|-------|---------|--------|
| **Compliance Agent** | KYC/KYB, risk scoring, watchlist screening | Đánh giá & thẩm định rủi ro đối tác |
| **Legal Agent** | Chọn hợp đồng, đánh dấu điều khoản theo mức rủi ro | Legal brief + điểm cần review |
| **Biz Agent** | Giao diện cho Business, điều phối quy trình | Timeline, next steps |

### Biz Agent (POV: Business)
- Giao diện chính cho nhân viên Business.
- Hướng dẫn thu thập thông tin đầy đủ ngay từ đầu.
- Chuyển hóa Risk brief + Legal brief thành hành động cụ thể (email/ticket cho PIC).
- Cung cấp timeline dự kiến và next steps; xử lý FAQ về quy trình.

### Compliance Agent (POV: Compliance)
- Automated KYC/KYB screening theo tiêu chí nội bộ.
- Risk scoring dựa trên MST, ngành nghề kinh doanh, KYB người đại diện.
- Đối chiếu watchlist và danh mục ngành bị hạn chế.
- Phân loại merchant: low / medium / high / unacceptable risk tier.

### Legal Agent (POV: Legal)
- Được trigger sau Compliance; chọn template và customize điều khoản theo mô hình hợp tác.
- Flag các điểm cần Legal counsel review trực tiếp.
- Giảm tải từ "đọc từ đầu" xuống còn "chỉ review điểm được flag".

### Cách 3 agent phối hợp — Sequential trigger + shared context
1. Biz Agent thu thập hồ sơ merchant.
2. Kích hoạt Compliance Agent.
3. Compliance trả về risk brief + risk tier.
4. Chuyển sang Legal Agent.
5. Legal Agent tạo legal brief + flag.
6. Trường hợp high-risk → chuyển sang human review.
7. Biz Agent tổng hợp: timeline, điều kiện, next steps.

## 4. Impact

- Nhân viên mới catch-up nhanh hơn.
- Chuẩn hóa quy trình → giảm phụ thuộc cá nhân, giảm rủi ro vận hành.
- Cross-team collaboration hiệu quả hơn; rút ngắn thời gian onboarding.
- Management có visibility tốt hơn (qua dashboard trong tương lai).

## 5. Hạn chế hiện tại & Hướng phát triển

**Hiện tại** 3 agent vẫn hoạt động rời rạc: chưa có Orchestrator điều phối trung tâm, chưa có ERP centralized → cần thao tác manual để nối các bước, chưa quản lý được state xuyên suốt, chưa có exception handling tự động, chưa có dashboard real-time.

**Hướng phát triển:**
- **Orchestrator Agent** — điều phối end-to-end workflow, state machine, retry logic, escalation tự động.
- **Real-time dashboard** — theo dõi toàn bộ quy trình, single source of truth.
- **ERP centralized** — quản lý task tập trung.
- Mở rộng sang các use case khác: Finance, HR, Procurement…

---

## Triển khai kỹ thuật

**Tech stack:** Node.js + TypeScript + Express · LLM MiniMax (qua VNG Cloud MaaS, OpenAI-compatible) · Docker · GreenNode AgentBase Runtime (endpoint public, health check `/health`, port 8080).

**Cấu trúc repo:**
```
new-merchant-onboarding-agent/   # Biz Agent (POV: Business)
compliance-agent/                # Compliance Agent
legal-agent/                     # Legal Agent
```

**Chạy local (mỗi agent):**
```bash
cd <agent-folder>
cp .env.example .env      # điền LLM_API_KEY, SMTP_USER/SMTP_PASS...
npm install
npm run build             # tsc -> dist/
npm start                 # http://localhost:8080
```

**Bảo mật:** `.env` (API key, mật khẩu email) và `.greennode.json` (IAM credentials) **không** được commit — xem `.gitignore`. Chỉ `.env.example` được theo dõi.

> Lưu ý: đây là bản demo. Một số năng lực (risk scoring tự động, watchlist, flag điều khoản hợp đồng) thể hiện định hướng sản phẩm; bản demo minh họa luồng phối hợp 3 agent end-to-end cho use case onboarding merchant.
