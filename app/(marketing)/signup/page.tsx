"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { buildCountryOptions } from "../_lib/countries";

export default function SignupPage() {
  const countries = useMemo(() => buildCountryOptions("en"), []);

  const [country, setCountry] = useState<string>("US");
  const [dial, setDial] = useState<string>("+1");

  const [phoneLocal, setPhoneLocal] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [pw, setPw] = useState<string>("");
  const [pw2, setPw2] = useState<string>("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  function onCountryChange(next: string) {
    setCountry(next);
    const found = countries.find((c) => c.code === next);
    if (found) setDial(found.dial);
  }

  const fullPhone = `${dial}${phoneLocal.replace(/[^\d]/g, "")}`;

  const phoneIsValid = useMemo(() => {
    if (!phoneLocal.trim()) return false;
    const parsed = parsePhoneNumberFromString(fullPhone);
    return Boolean(parsed && parsed.isValid());
  }, [fullPhone, phoneLocal]);

  const pwMatch = pw.length > 0 && pw === pw2;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.card} className="ob-card">
          <h1 style={styles.h1} className="ob-fadeUp">
            Create your account
          </h1>
          <p style={styles.sub} className="ob-fadeUp ob-delay1">
            Sign up to get started with OPENBOOK.
          </p>

          <div style={styles.form} className="ob-fadeUp ob-delay2">
            <label style={styles.label}>Country</label>
            <select style={styles.select} value={country} onChange={(e) => onCountryChange(e.target.value)}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.dial})
                </option>
              ))}
            </select>

            <label style={styles.label}>Phone number</label>
            <div style={styles.phoneRow}>
              <input style={styles.dial} value={dial} readOnly aria-label="Dial code" />
              <input
                style={styles.phoneInput}
                inputMode="tel"
                placeholder="Phone number"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value)}
                autoComplete="tel"
              />
            </div>

            {phoneLocal.trim() ? (
              <div
                style={{
                  ...styles.hint,
                  color: phoneIsValid ? "rgba(120,255,190,0.92)" : "rgba(255,140,140,0.92)",
                }}
              >
                {phoneIsValid ? "Phone number looks valid." : "Phone number is not valid."}
              </div>
            ) : null}

            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label style={styles.label}>Password</label>
            <div style={styles.pwRow}>
              <input
                style={{ ...styles.input, paddingRight: 54 }}
                placeholder="••••••••"
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPw((s) => !s)} aria-label="Toggle password">
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>

            <label style={styles.label}>Confirm password</label>
            <div style={styles.pwRow}>
              <input
                style={{ ...styles.input, paddingRight: 54 }}
                placeholder="••••••••"
                type={showPw2 ? "text" : "password"}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPw2((s) => !s)} aria-label="Toggle confirm password">
                {showPw2 ? "🙈" : "👁️"}
              </button>
            </div>

            {pw2 ? (
              <div
                style={{
                  ...styles.hint,
                  color: pwMatch ? "rgba(120,255,190,0.92)" : "rgba(255,140,140,0.92)",
                }}
              >
                {pwMatch ? "Passwords match." : "Passwords do not match."}
              </div>
            ) : null}

            <button style={styles.primaryBtn}>Create account</button>

            <Link href="/login" style={styles.secondaryBtn}>
              ← Back to Login
            </Link>

            <p style={styles.small}>
              By continuing, you agree to our <span style={styles.linkLike}>Terms</span> &{" "}
              <span style={styles.linkLike}>Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ob-card {
          animation: obPop 520ms ease both;
        }
        .ob-fadeUp {
          opacity: 0;
          transform: translateY(10px);
          animation: obFadeUp 520ms ease forwards;
        }
        .ob-delay1 {
          animation-delay: 80ms;
        }
        .ob-delay2 {
          animation-delay: 140ms;
        }
        @keyframes obFadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes obPop {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-card,
          .ob-fadeUp {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: "max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom))",
    boxSizing: "border-box",
  },
  shell: {
    width: "100%",
    maxWidth: 560,
  },
  card: {
    width: "100%",
    borderRadius: 22,
    background: "rgba(16, 18, 22, 0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 70px rgba(0,0,0,0.55)",
    padding: "clamp(16px, 3.5vw, 22px)",
    backdropFilter: "blur(14px)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  h1: {
    fontSize: "clamp(30px, 7.5vw, 40px)",
    margin: "0 0 6px",
    letterSpacing: -0.5,
    lineHeight: 1.08,
  },
  sub: {
    margin: "0 0 18px",
    opacity: 0.75,
    fontSize: "clamp(13px, 3.2vw, 15px)",
    lineHeight: 1.4,
  },
  form: { display: "grid", gap: 12 },
  label: { fontSize: 12, opacity: 0.75, letterSpacing: 1, textTransform: "uppercase" },
  select: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,10,14,0.8)",
    color: "white",
    padding: "0 16px",
    outline: "none",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,10,14,0.8)",
    color: "white",
    padding: "0 16px",
    outline: "none",
    boxSizing: "border-box",
  },
  phoneRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  dial: {
    flex: "0 0 92px",
    minWidth: 84,
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,10,14,0.8)",
    color: "rgba(255,255,255,0.85)",
    padding: "0 12px",
    outline: "none",
    boxSizing: "border-box",
  },
  phoneInput: {
    flex: "1 1 180px",
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,10,14,0.8)",
    color: "white",
    padding: "0 16px",
    outline: "none",
    boxSizing: "border-box",
  },
  pwRow: { position: "relative" },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
  },
  hint: { fontSize: 13, opacity: 0.92, marginTop: 2 },
  primaryBtn: {
    width: "100%",
    height: 58,
    borderRadius: 18,
    border: "0",
    background: "linear-gradient(180deg, #2f6bff, #1f55d8)",
    color: "white",
    fontWeight: 900,
    fontSize: 20,
    cursor: "pointer",
    marginTop: 4,
  },
  secondaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    display: "grid",
    placeItems: "center",
    textDecoration: "none",
    fontWeight: 800,
  },
  small: { margin: "8px 0 0", opacity: 0.7, fontSize: 12, textAlign: "center" },
  linkLike: { color: "#6bd1ff", textDecoration: "underline", cursor: "pointer" },
};