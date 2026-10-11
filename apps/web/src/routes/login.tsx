import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/app/button";
import { authClient } from "@/lib/auth-client";
import { loadSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await loadSession();
    if (session) {
      throw redirect({
        to: session.user.role === "brigadista" ? "/campo" : "/",
      });
    }
  },
  component: LoginPage,
});

const FIELD =
  "min-h-12 w-full rounded-md border border-edge bg-white px-3.5 text-base text-ink placeholder:text-ink-3/70 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary/30";

function LoginPage() {
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (authError) {
      setBusy(false);
      setError(
        authError.status === 401 || authError.status === 400
          ? "Correo o contraseña incorrectos."
          : "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo."
      );
      return;
    }
    const session = await loadSession();
    setBusy(false);
    await navigate({
      to: session?.user.role === "brigadista" ? "/campo" : "/",
    });
  }

  return (
    <main
      className="relative isolate grid min-h-svh overflow-hidden bg-primary lg:grid-cols-[minmax(0,1fr)_minmax(420px,460px)]"
      data-sec="panel"
    >
      <img
        alt=""
        className="absolute inset-0 -z-20 hidden size-full object-cover lg:block object-[22%_78%] lg:object-[28%_55%]"
        fetchPriority="high"
        height={1024}
        src="/bg-login.webp"
        width={1536}
      />
      <section className="relative isolate hidden flex-col justify-end p-6 text-white lg:flex lg:p-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-tr from-primary/90 via-primary/45 to-transparent"
        />
        <div className="hidden max-w-[34rem] flex-col gap-5 lg:flex">
          <p className="text-balance font-bold text-5xl leading-[1.05] tracking-[-0.02em] xl:text-6xl">
            Bosque manejado, ¡Futuro asegurado!
          </p>
          <p className="max-w-[30rem] font-serif text-lg text-white/90 leading-relaxed">
            Inventario y monitoreo del bosque seco en tiempo real.
          </p>
        </div>
        <p className="mt-0 hidden text-sm text-white/80 lg:mt-14 lg:block">
          Plataforma de gestión y monitoreo del bosque seco · Tumbes y Piura
        </p>
      </section>

      <section className="paso relative flex min-h-svh flex-col justify-center gap-8 bg-sheet px-6 py-10 sm:px-12 lg:bg-sheet/80 lg:px-10 lg:backdrop-blur-2xl lg:backdrop-saturate-150">
        <div className="mx-auto my-auto flex w-full max-w-sm flex-col gap-7">
          <header className="flex flex-col gap-6">
            <img
              alt="AIDER"
              className="mx-auto size-28"
              height={112}
              src="/brand/aider-mark.png"
              width={112}
            />
            <div className="flex flex-col gap-1 text-center">
              <h1 className="font-bold text-5xl text-[#1e5132] tracking-tight">
                SIBOSE
              </h1>
              <p className="font-semibold text-[#1e5132] text-sm">
                Sistema de Inventario de Bosque Seco
              </p>
            </div>
          </header>

          <form
            aria-describedby={error ? errorId : undefined}
            className="flex flex-col gap-5"
            noValidate={false}
            onSubmit={onSubmit}
          >
            <div className="flex flex-col gap-1.5">
              <label
                className="font-semibold text-ink-2 text-sm"
                htmlFor={emailId}
              >
                Correo
              </label>
              <input
                autoComplete="username"
                className={FIELD}
                id={emailId}
                inputMode="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@organizacion.org"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="font-semibold text-ink-2 text-sm"
                htmlFor={passwordId}
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  autoComplete="current-password"
                  className={`${FIELD} pr-12`}
                  id={passwordId}
                  minLength={8}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-3 hover:text-ink"
                  onClick={() => setShowPassword((v) => !v)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" size={18} />
                  ) : (
                    <Eye aria-hidden="true" size={18} />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p
                className="rounded-lg border border-crit/30 bg-crit-bg px-3.5 py-2.5 text-crit-fg text-sm"
                id={errorId}
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <Button disabled={busy} size="lg" type="submit" variant="primary">
              {busy ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin"
                    size={18}
                  />
                  Ingresando…
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
