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
      className="grid min-h-svh bg-paper lg:grid-cols-[minmax(0,1.15fr)_minmax(440px,1fr)]"
      data-sec="panel"
    >
      <section
        aria-hidden="true"
        className="relative h-56 overflow-hidden bg-primary sm:h-72 lg:h-auto"
      >
        <img
          alt=""
          className="absolute inset-0 size-full object-cover object-[22%_78%] lg:object-[28%_55%]"
          fetchPriority="high"
          height={1024}
          src="/bg-login.webp"
          width={1536}
        />
      </section>

      <section className="relative flex flex-col justify-center bg-sec px-3 py-8 sm:px-8 lg:px-12">
        <div className="hoja paso mx-auto flex w-full max-w-md flex-col gap-7 px-6 py-8 sm:px-9 sm:py-10">
          <header className="flex flex-col gap-4">
            <img
              alt="AIDER"
              className="rounded-full"
              height={52}
              src="/brand/aider-mark.png"
              width={52}
            />
            <div className="flex flex-col gap-1.5">
              <h1 className="font-bold text-3xl tracking-tight">
                Inventario Forestal
              </h1>
              <p className="font-serif text-[15px] text-ink-3 leading-relaxed">
                Ingresa con tu cuenta para registrar en campo o revisar las
                mediciones.
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

          <p className="text-ink-3 text-xs">
            Las cuentas las crea un administrador. Si no tienes una, pídesela a
            tu jefe de brigada.
          </p>
        </div>
      </section>
    </main>
  );
}
