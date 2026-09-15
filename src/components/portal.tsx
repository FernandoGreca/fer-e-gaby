"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Heart, LockKeyhole, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAIL } from "@/lib/config";
import { services } from "@/lib/services";
import { Modal } from "./modal";
const AuthContext = createContext({ admin: false });
export const useAuth = () => useContext(AuthContext);
export function Portal({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
      }),
  );
  const [admin, setAdmin] = useState(false);
  const [login, setLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    async function refresh(hasSession: boolean) {
      const version = ++generation.current;
      if (!hasSession) {
        setAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_admin");
      if (active && version === generation.current)
        setAdmin(!error && data === true);
    }
    void supabase.auth.getSession().then(({ data }) => refresh(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run outside the Auth callback lock before making a Supabase request.
      setTimeout(() => {
        if (active) void refresh(!!session);
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password,
      });
      setPassword("");
      if (error) throw error;
      const result = await supabase.rpc("is_admin");
      if (result.error || result.data !== true) {
        await supabase.auth.signOut();
        throw new Error("unauthorized");
      }
      setAdmin(true);
      setLogin(false);
    } catch {
      setPassword("");
      setError(
        "Não foi possível entrar. Confira a senha e a conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signOut();
    if (error) setError("Não foi possível encerrar a sessão. Tente novamente.");
    else {
      generation.current++;
      setAdmin(false);
    }
    setBusy(false);
  }
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ admin }}>
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        <header className="site-header portal-header">
          <Link href="/" className="brand" aria-label="Fer mais Gaby, início">
            <Heart size={22} />
            <span>
              Fer <i>+</i> Gaby
            </span>
          </Link>
          <nav className="portal-nav" aria-label="Navegação principal">
            <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
              Início
            </Link>
            {services.map((service) => (
              <Link
                key={service.href}
                href={service.href}
                aria-current={
                  pathname?.replace(/\/$/, "") === service.href
                    ? "page"
                    : undefined
                }
              >
                {service.title}
              </Link>
            ))}
          </nav>
          {admin ? (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
              Sair
            </button>
          ) : (
            <button
              className="text-button edit-entry"
              onClick={() => {
                setError("");
                setLogin(true);
              }}
            >
              <LockKeyhole size={15} />
              Modo de edição
            </button>
          )}
        </header>
        {error && !login && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        {children}
        <footer>
          <span>
            Fer <i>+</i> Gaby
          </span>
          <p>Feito com amor, para compartilhar sorrisos.</p>
          <Heart size={14} />
        </footer>
        {login && (
          <Modal
            title="Nosso modo de edição"
            description="Entre com a senha compartilhada para cuidar das listas e das nossas fotos."
            onClose={() => {
              if (!busy) {
                setLogin(false);
                setPassword("");
              }
            }}
          >
            <form onSubmit={signIn}>
              <label className="field">
                Senha
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
              <button className="button full" disabled={busy}>
                {busy ? "Entrando…" : "Entrar"}
              </button>
            </form>
          </Modal>
        )}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
