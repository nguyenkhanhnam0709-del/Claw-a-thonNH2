Zalopay Merchant Onboarding - Multi-Agent System

Hệ thống gồm 3 AI Agent hỗ trợ toàn bộ quy trình onboarding merchant mới cho cổng thanh toán ZaloPay, xây dựng trên nền tảng GreenNode AgentBase (VNG Cloud). Mỗi agent đại diện cho một vai trò trong quy trình 4 giai đoạn: (1) Thẩm định Merchant - Compliance, (2) Review Hợp đồng - Legal, (3) Tích hợp kỹ thuật - Tech, (4) Tạo FA Code - Accounting.

Luồng tổng thể: BD dùng Onboarding Agent để chuẩn bị hồ sơ và gửi yêu cầu cho từng PIC; Compliance Agent duyệt hồ sơ Phase 1; Legal Agent rà soát hợp đồng Phase 2; BD tiếp tục Phase 3 và 4 đến khi merchant go-live.


1. Merchant Onboarding Agent (POV: BD)

- Giải quyết vấn đề gì: BD mất thời gian tra cứu quy trình, soạn email và ticket thủ công, dễ thiếu sót tài liệu. Agent tự động hoá và chuẩn hoá toàn bộ thao tác này.
- Ai sử dụng: đội Business Development (BD) của ZaloPay - người trực tiếp onboarding merchant mới.
- Hoạt động thế nào: BD chat bằng tiếng Việt; agent giải đáp quy trình, kiểm tra tài liệu đủ hay thiếu, tạo và gửi email thật cho PIC ở Phase 1/2/4 (kèm tài liệu đính kèm và CC cho người cần theo dõi), tạo ticket Jira cho Phase 3, và tra cứu mã số thuế doanh nghiệp.
- Giá trị mang lại: rút ngắn thời gian onboarding, chuẩn hoá nội dung và gửi đúng người nhận, giảm sai sót, đính kèm đúng tài liệu ngay từ đầu nên rút ngắn vòng phê duyệt.


2. Compliance Agent (POV: Compliance)

- Giải quyết vấn đề gì: Compliance phải theo dõi nhiều hồ sơ chờ duyệt và phản hồi BD một cách phân tán. Agent giúp quản lý hàng đợi hồ sơ và ra quyết định tập trung.
- Ai sử dụng: đội Compliance - người thẩm định và phê duyệt hồ sơ merchant ở Phase 1.
- Hoạt động thế nào: nhận yêu cầu thẩm định từ Biz, đưa vào hàng đợi chờ duyệt; Compliance quyết định Approve (cho phép sang Phase 2) hoặc Reject kèm lý do và tài liệu cần bổ sung; agent tự động gửi email thông báo kết quả cho BD.
- Giá trị mang lại: tập trung theo dõi mọi hồ sơ Phase 1, quyết định minh bạch (luôn kèm lý do khi từ chối), khép vòng phản hồi tự động giữa Compliance và BD.


3. Legal Contract Review Agent (POV: Legal)

- Giải quyết vấn đề gì: rà soát hợp đồng thủ công tốn thời gian và dễ bỏ sót điều khoản. Agent hỗ trợ rà soát theo checklist và ra quyết định pháp lý nhất quán.
- Ai sử dụng: đội Legal - người rà soát và phê duyệt hợp đồng dịch vụ merchant ở Phase 2.
- Hoạt động thế nào: nhận draft hợp đồng từ BD (sau khi Compliance đã duyệt Phase 1), rà soát các điều khoản theo Legal Checklist, ra một trong ba quyết định kèm lý do: Approve, Reject, hoặc Request Revision (yêu cầu chỉnh sửa); theo dõi trạng thái hợp đồng và thông báo cho BD.
- Giá trị mang lại: giảm rủi ro pháp lý nhờ rà soát theo bộ tiêu chí chuẩn, phản hồi rõ ràng giúp BD và merchant xử lý nhanh, rút ngắn thời gian từ draft đến khi ký kết.


Tech stack: Node.js + TypeScript + Express, LLM MiniMax (qua VNG Cloud MaaS, OpenAI-compatible), Docker, GreenNode AgentBase Runtime.

Tài liệu chi tiết và hướng dẫn chạy/triển khai: xem file DOCS.md
