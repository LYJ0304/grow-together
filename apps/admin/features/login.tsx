"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/lib/demo-context";
export function LoginScreen() {
  const [email, setEmail] = useState("operator@example.test");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { startSession } = useDemo();
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      setError("샘플 이메일과 8자 이상의 임의 비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    await new Promise((resolve) => setTimeout(resolve, 450));
    startSession();
    setPassword("");
    router.push("/");
    setLoading(false);
  }
  return (
    <main className="login-page">
      <div className="login-top">
        <Link href="/" className="login-brand">
          <Image
            src="/brand-mark.png"
            alt="Grow Together"
            width={34}
            height={34}
          />
          <strong>Grow Together</strong>
        </Link>
        <span className="demo-badge">Frontend-only demo</span>
      </div>
      <section className="login-panel">
        <div className="login-symbol">
          <Image src="/brand-mark.png" alt="" width={48} height={48} priority />
        </div>
        <div className="eyebrow">OPERATIONS, TOGETHER</div>
        <h1>Grow Together Admin</h1>
        <p className="login-description">
          차분하게 살피고, 함께 더 나은 서비스를.
          <br />
          관리 콘솔의 데모 화면을 둘러보세요.
        </p>
        <div className="login-warning">
          <ShieldAlert size={18} />
          <p>
            <strong>실제 관리자 로그인이 아닙니다.</strong> 임의의 샘플 값만
            입력하세요. 실제 비밀번호는 사용하지 마세요.
          </p>
        </div>
        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>샘플 이메일</span>
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@example.test"
              disabled={loading}
            />
          </label>
          <label className="field">
            <span>임의 비밀번호</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상의 임의 문자열"
              disabled={loading}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="animate-spin" size={16} />
                데모 준비 중
              </>
            ) : (
              <>
                데모 로그인
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>
        <Link className="login-skip" href="/">
          로그인 시뮬레이션 없이 샘플 보기 <ArrowRight size={14} />
        </Link>
        <p className="login-security-note">
          이 화면은 인증이나 접근 제어를 제공하지 않습니다.
          <br />
          모든 경로에는 공개된 샘플 데이터만 표시됩니다.
        </p>
      </section>
      <footer className="login-footer">
        Grow Together Admin · Prototype · 실제 서비스 연결 없음
      </footer>
    </main>
  );
}
