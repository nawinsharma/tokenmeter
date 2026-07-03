export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-indigo-500" />
          <span className="text-sm font-semibold tracking-tight text-white">
            Token Meter
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
