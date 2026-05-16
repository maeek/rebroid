# Shop Me Alone Web

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

Point the web app at the orchestrator:

```bash
ORCHESTRATOR_API_URL=http://localhost:4100
NEXT_PUBLIC_SCRCPY_BASE_URL=http://localhost:8000
WEB_SETTINGS_PATH=./data/web-settings.json
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=4096mb
NEXT_PROXY_MAX_APK_UPLOAD_SIZE_MB=4096
```

When the orchestrator runs on your Linux redroid host, use that host instead:

```bash
ORCHESTRATOR_API_URL=http://your-linux-host:4100
NEXT_PUBLIC_SCRCPY_BASE_URL=https://your-public-scrcpy-host
```

The web app stores frontend-only settings in `WEB_SETTINGS_PATH`. Orchestrator-owned runtime settings are fetched from the Nest API at `/settings`.

The APK limit in General Settings is the effective upload limit. `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` is the Next.js transport ceiling and requires a server restart if changed. `NEXT_PROXY_MAX_APK_UPLOAD_SIZE_MB` is the proxy route's maximum accepted value for the mirrored settings cookie. `NEXT_PUBLIC_SCRCPY_BASE_URL` controls the public base URL used by the embedded Android viewer; if it is unset, the frontend falls back to the current browser origin.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [https://localhost:3000](https://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
