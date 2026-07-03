"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const orgName = String(form.get("orgName") ?? "").trim();

    const { error } =
      mode === "signup"
        ? await signUp.email({ email, password, name: orgName || email })
        : await signIn.email({ email, password });

    if (error) {
      setError(error.message ?? "Something went wrong");
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setGooglePending(true);
    // Redirects to Google, then back to /dashboard on success.
    const { error } = await signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
    if (error) {
      setError(error.message ?? "Google sign-in failed");
      setGooglePending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-white">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        {mode === "signup"
          ? "Start tracking your LLM usage and cost."
          : "Sign in to your usage dashboard."}
      </p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending || pending}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        <GoogleIcon />
        {googlePending ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-800" />
        <span className="text-xs uppercase tracking-wide text-neutral-500">or</span>
        <div className="h-px flex-1 bg-neutral-800" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <Field
            label="Workspace name"
            name="orgName"
            type="text"
            placeholder="Acme Inc"
            required={false}
          />
        )}
        <Field label="Email" name="email" type="email" placeholder="you@company.com" />
        <Field
          label="Password"
          name="password"
          type="password"
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
        />

        {error && (
          <p className="rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || googlePending}
          className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-400">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={
          name === "password"
            ? type === "password"
              ? "current-password"
              : "off"
            : name
        }
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.4 14.97.42 12 .42a11 11 0 0 0-9.82 6.64l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
      />
    </svg>
  );
}
