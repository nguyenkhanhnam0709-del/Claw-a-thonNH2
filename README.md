Zalopay Multi-Agent System - Chuẩn hóa quy trình vận hành (mini-ERP)

Nền tảng AI multi-agent giúp chuẩn hóa (standardize), theo dõi (tracking) và tự động hóa các quy trình vận hành đa phòng ban (cross-function) tại Zalopay: Business, Compliance, Legal, FP&A, Operations...

Vấn đề (painpoints):
- Quy trình cross-functional nhiều bước, qua nhiều phòng ban; nhân sự mới khó nhớ trình tự, hồ sơ cần chuẩn bị và PIC từng giai đoạn - phụ thuộc "truyền miệng".
- Thiếu chuẩn hóa: mỗi team làm một kiểu, dễ sai lệch, khó cập nhật đồng bộ khi policy/regulation thay đổi.
- Communication phân mảnh qua nhiều kênh (email, chat, ticket) nên dễ miss request và không có single source of truth.

Giải pháp: nhiều AI agent chuyên biệt, mỗi agent được "nhúng" kiến thức và quy trình chuẩn của một function, phối hợp theo workflow tiêu chuẩn để: (1) chuẩn hóa & đảm bảo nhất quán (dùng 24/7, cập nhật tập trung), (2) tăng khả năng quản lý tổng thể, (3) giảm rủi ro vận hành.

Demo use case: Onboarding 1 merchant mới - gồm 3 agent tương ứng 3 function.


1. Biz Agent (POV: Business)
- Giải quyết vấn đề gì: BD khó nhớ quy trình, dễ thiếu hồ sơ, phải thao tác thủ công và phụ thuộc người có kinh nghiệm.
- Ai sử dụng: nhân viên Business (BD).
- Hoạt động thế nào: là giao diện chính cho BD; hướng dẫn thu thập đủ thông tin ngay từ đầu, điều phối quy trình, chuyển risk brief + legal brief thành hành động cụ thể (gửi email/tạo ticket cho PIC), cung cấp timeline dự kiến và next steps, xử lý FAQ về quy trình.
- Giá trị mang lại: rút ngắn thời gian onboarding, chuẩn hóa thao tác, giảm sai sót và giảm phụ thuộc cá nhân.

2. Compliance Agent (POV: Compliance)
- Giải quyết vấn đề gì: thẩm định và đánh giá rủi ro đối tác làm thủ công, dễ thiếu sót, khó nhất quán.
- Ai sử dụng: đội Compliance.
- Hoạt động thế nào: tự động KYC/KYB theo tiêu chí nội bộ; chấm điểm rủi ro (risk scoring) dựa trên MST, ngành nghề kinh doanh và người đại diện; đối chiếu watchlist và danh mục ngành bị hạn chế; phân loại merchant theo risk tier (low/medium/high/unacceptable) và trả risk brief cho Biz.
- Giá trị mang lại: thẩm định nhất quán và minh bạch, giảm rủi ro vận hành ngay từ đầu quy trình.

3. Legal Agent (POV: Legal)
- Giải quyết vấn đề gì: rà soát hợp đồng từ đầu tốn thời gian, dễ bỏ sót điều khoản rủi ro.
- Ai sử dụng: đội Legal.
- Hoạt động thế nào: được trigger sau Compliance; chọn template hợp đồng và tùy chỉnh điều khoản theo mô hình hợp tác; flag (đánh dấu) các điểm cần Legal review trực tiếp; tạo legal brief để Legal "chỉ review điểm được flag" thay vì đọc lại từ đầu.
- Giá trị mang lại: giảm rủi ro pháp lý, giảm tải cho Legal, rút ngắn thời gian xử lý hợp đồng.


Cách 3 agent phối hợp (Sequential trigger + shared context):
Biz thu thập hồ sơ merchant -> kích hoạt Compliance -> Compliance trả risk brief + risk tier -> chuyển Legal -> Legal tạo legal brief + flag -> trường hợp high-risk thì chuyển human review -> Biz tổng hợp timeline, điều kiện và next steps.

Impact: nhân sự mới catch-up nhanh hơn; chuẩn hóa giảm phụ thuộc cá nhân và giảm rủi ro vận hành; cross-team collaboration hiệu quả hơn; rút ngắn thời gian onboarding.

Tech stack: Node.js + TypeScript + Express, LLM MiniMax (VNG Cloud MaaS, OpenAI-compatible), Docker, GreenNode AgentBase Runtime.

Roadmap: hiện 3 agent còn hoạt động rời rạc. Hướng phát triển: Orchestrator Agent điều phối end-to-end (state machine, retry, escalation), real-time dashboard (single source of truth), ERP tập trung; mở rộng sang các function khác (Finance, HR, Procurement).

Tài liệu chi tiết và hướng dẫn chạy/triển khai: xem file DOCS.md
