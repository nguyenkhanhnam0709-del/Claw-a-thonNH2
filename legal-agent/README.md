# Legal Contract Review Agent (Phase 2)

Agent rà soát & phê duyệt hợp đồng dịch vụ merchant (POV: Legal) cho quy trình
onboarding Zalopay. Node + TypeScript + Express, chạy trên GreenNode AgentBase.

## Cấu trúc
- `src/index.ts` — server: endpoints + LLM agent (chat, approve/reject/revision)
- `src/services/email.ts` — gửi email (SMTP: Gmail/Outlook)
- `src/services/memory.ts` — lưu lịch sử hội thoại (AgentBase Memory)
- `public/legal.html` — giao diện Legal (Zalopay style)

## Chạy local
```bash
npm install
cp .env.example .env   # điền LLM_API_KEY + SMTP_*
npm run build && npm start
# mở http://localhost:8080
```

## API chính
- `POST /api/chat/legal` — chat với Legal agent
- `GET  /api/contracts/status` — danh sách hợp đồng chờ rà soát
- `POST /api/contracts/submit-legal` — BD nộp hợp đồng
- `POST /api/legal/review` — quyết định approve / reject / revision
- `GET  /health` — health check (port 8080)
