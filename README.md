# GPCC 香港站 RSVP

2026「凱瑞麟盃」粵港澳大灣區匹克球城市挑戰賽（香港站）海選賽官方報名系統。

Stack: **Express.js + MongoDB (Mongoose) + EJS + Tailwind CSS**  
Design reference: [gpcchkmo.org](https://gpcchkmo.org/) · Open Design project `gpcchkmo-rsvp`

## Quick start

```bash
cp .env.example .env
npm install
npm run build:css
npm run seed
npm start
```

Open http://localhost:3480/rsvp

## Phase 1 scope

- 6-step public application form (PDF sections 0–5)
- Age-group / doubles-event eligibility filtering
- Max 2 active events per player (email / WhatsApp)
- Persist `Team` + `Player` with status `submitted_pending_payment`
- Success page: **已收到申請／待付款待核實**（無 QR、無隊伍編號）

## Later phases (stubs ready)

| Module | Path |
|--------|------|
| Stripe / FPS payment | `server/services/paymentService.js` |
| Email stages | `server/services/emailService.js` |
| Pack / check-in QR | `server/services/qrService.js` |
| Audit log | `server/models/AuditLog.js` |

## Open Design

```bash
cd ../open-design
pnpm tools-dev -- --daemon-port 7456 --web-port 5173
```

- Project: `gpcchkmo-rsvp`
- Design artifact: `rsvp/index.html` + `rsvp/tokens.css`
- Studio: http://127.0.0.1:5173/projects/gpcchkmo-rsvp

Note: `start_run` with `cursor-agent` requires `cursor-agent login` (or `CURSOR_API_KEY`). Brand UI is already in the OD artifact and wired into this repo’s EJS + Tailwind form.
