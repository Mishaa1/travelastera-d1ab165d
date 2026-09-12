export function SsoButtons() {
  return <div className="space-y-2.5">
    <a href="/api/auth/oauth/google" className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-ink hover:text-white"><span className="text-base font-bold text-[#4285f4]">G</span>Continue with Google</a>
    <a href="/api/auth/oauth/apple" className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-ink hover:text-white"><span className="text-lg">●</span>Continue with Apple</a>
  </div>;
}
