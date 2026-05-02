/**
 * Syncs demo API bearer with the server: client rehearsal/reset routes use
 * Authorization: Bearer from window.__DEMO_TOKEN (see runLiveRehearsals).
 * Without this, production often used a random DEMO_RESET_TOKEN on Vercel while
 * the client defaulted to bridge-demo-2026 → 401 on every demo POST.
 *
 * The value is visible in page source (same exposure as NEXT_PUBLIC_*); it only
 * gates demo maintenance endpoints, not the main app.
 */
export default function WarRoomLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const token = process.env.DEMO_RESET_TOKEN ?? "bridge-demo-2026";
  return (
    <>
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `window.__DEMO_TOKEN=${JSON.stringify(token)};`,
        }}
      />
      {children}
    </>
  );
}
