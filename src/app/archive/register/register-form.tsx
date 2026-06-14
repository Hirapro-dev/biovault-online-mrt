"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Loader, Eye, EyeOff } from "lucide-react";

// グループA/Bどちらの登録フォームでも共用するコンポーネント
export function ArchiveRegisterForm({ group }: { group: "a" | "b" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const composeKana = useRef("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  // パスワードの表示/非表示（デフォルトは表示）
  const [showPassword, setShowPassword] = useState(true);
  const [zipCode, setZipCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [isZipLoading, setIsZipLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHiraganaOnly = (s: string) => /^[ぁ-ゖー　\s]*$/.test(s);

  const handleNameCompositionStart = () => {
    composeKana.current = "";
    if (/[\s　]$/.test(name)) {
      setNameKana((prev) =>
        prev && !/[\s　]$/.test(prev) ? prev + " " : prev
      );
    }
  };

  const commitKana = () => {
    if (composeKana.current) {
      const kana = composeKana.current;
      composeKana.current = "";
      setNameKana((prev) => prev + kana);
    }
  };

  const handleNameCompositionEnd = () => {
    commitKana();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    const value = e.target.value;
    setName(value);
    if (value === "") {
      setNameKana("");
      composeKana.current = "";
      return;
    }
    const data = native?.data;
    if (native?.isComposing && data) {
      if (/[一-龯々]/.test(data)) {
        commitKana();
      } else if (isHiraganaOnly(data)) {
        composeKana.current = data;
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setPhone(digits);
  };

  const handleZipCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 7);
    setZipCode(digits);
    if (digits.length === 7) {
      setIsZipLoading(true);
      try {
        const res = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`
        );
        const data = await res.json();
        if (data.results?.[0]) {
          const r = data.results[0];
          setAddress1(`${r.address1}${r.address2}${r.address3}`);
        }
      } catch {
        // 取得失敗は無視
      } finally {
        setIsZipLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // パスワード：6文字以上の半角英数字 + 確認一致チェック
    if (!/^[A-Za-z0-9]{6,}$/.test(password)) {
      setError("パスワードは6文字以上の半角英数字で入力してください");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワード（確認）が一致しません");
      return;
    }

    setIsLoading(true);
    setError(null);

    const fullAddress = [`〒${zipCode}`, address1, address2]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await fetch("/api/archive/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          name_kana: nameKana,
          phone,
          email,
          password,
          address: fullAddress,
          confidentiality_agreed: agreed,
          member_group: group,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "登録に失敗しました");

      router.push(
        `/archive/thanks?id=${encodeURIComponent(result.login_id)}&pw=${encodeURIComponent(result.password)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setIsLoading(false);
    }
  };

  const inputClass =
    "h-12 rounded-lg border-0 bg-[#0d1520] text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40";

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#050a0e] via-[#05140f] to-[#03110c] text-white">
      {/* ヒーロー（背景動画 + 左テキスト・右画像）。参考デザインの寸法に合わせる */}
      <div className="relative h-[420px] w-full overflow-hidden sm:h-[480px] lg:h-[540px]">
        {/* 背景動画（元の背景動画を使用） */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/video-bg.png"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
        {/* 暗いオーバーレイ */}
        <div className="absolute inset-0 bg-black/45" />
        {/* 右側に画像（永島さん） */}
        <div
          className="absolute inset-y-0 right-0 w-[52%] bg-cover bg-top sm:w-[48%]"
          style={{ backgroundImage: "url(/nagashima_black01.png)" }}
        />
        {/* 左を暗くフェードしてテキストの可読性を確保（全体と同じ黒×グリーン） */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050a0e] via-[#050a0e]/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#050a0e] to-transparent" />

        {/* 左寄せのテキスト（すべて白） */}
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6 sm:px-10 lg:px-16">
          <div className="mb-7">
            <div className="font-serif text-3xl tracking-wide text-white sm:text-4xl">
              BioVault
            </div>
            <div className="mt-1.5 text-xs tracking-[0.4em] text-teal-200/80 sm:text-sm">
              Membership Service
            </div>
          </div>
          <h1 className="font-serif text-[2.5rem] font-bold leading-[1.18] text-white sm:text-5xl lg:text-6xl">
            Live配信映像視聴
            <br />
            機密保持契約同意フォーム
          </h1>
          <div className="mt-7 h-px w-[78%] max-w-lg bg-gradient-to-r from-teal-400 via-emerald-400/50 to-transparent" />
        </div>
      </div>

      {/* 導入文 */}
      <div className="mx-auto max-w-6xl px-6 py-9 sm:px-10 lg:px-16">
        <p className="text-base leading-loose text-slate-300 sm:text-lg">
          本フォームは機密情報を含むLive配信映像を視聴いただくための手続きです。機密保持契約にご同意のうえ、必要事項をご入力ください。
        </p>
      </div>

      {/* フォームカード */}
      <div className="mx-auto max-w-2xl px-4 pb-14">
        <div className="rounded-2xl border border-teal-500/30 bg-[#070f0c]/95 px-6 py-8 shadow-2xl sm:px-10 sm:py-10">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">申請者情報</h2>
            <div className="mt-3 h-px w-full bg-gradient-to-r from-teal-500/60 to-transparent" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-base font-medium text-white">氏名</label>
              <Input
                defaultValue=""
                onChange={handleNameChange}
                onCompositionStart={handleNameCompositionStart}
                onCompositionEnd={handleNameCompositionEnd}
                placeholder="山田 太郎"
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-base font-medium text-white">
                ふりがな
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ※氏名入力で自動反映されます
                </span>
              </label>
              <Input
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
                placeholder="やまだ たろう"
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-base font-medium text-white">電話番号</label>
              <Input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="09012345678"
                maxLength={11}
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-base font-medium text-white">
                メールアドレス
                <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  ※ログインIDになります
                </span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-base font-medium text-white">
                パスワード
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ※6文字以上の半角英数字
                </span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上の半角英数字"
                  autoComplete="new-password"
                  className={`${inputClass} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300"
                  tabIndex={-1}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-base font-medium text-white">パスワード（確認）</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="同じパスワードを再入力"
                  autoComplete="new-password"
                  className={`${inputClass} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300"
                  tabIndex={-1}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-base font-medium text-white">現住所</p>
              <div className="space-y-1.5">
                <label className="text-base text-slate-400">郵便番号</label>
                <div className="relative">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    value={zipCode}
                    onChange={handleZipCodeChange}
                    placeholder="1234567（ハイフンなし7桁）"
                    maxLength={7}
                    className={inputClass}
                    required
                  />
                  {isZipLoading && (
                    <Loader className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-400" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-base text-slate-400">
                  住所1
                  <span className="ml-2 text-xs text-slate-600">
                    ※郵便番号入力で自動反映
                  </span>
                </label>
                <Input
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder="東京都渋谷区渋谷"
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-base text-slate-400">住所2</label>
                <Input
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="1-2-3 〇〇ビル101"
                  className={inputClass}
                />
              </div>
            </div>

            {/* 機密保持契約 */}
            <div className="space-y-3 pt-2">
              <p className="text-sm font-semibold text-amber-300">*機密保持契約</p>
              <p className="text-sm text-white">
                この録画配信には機密情報が含まれています。以下の機密保持契約内容をご確認ください。
              </p>
              <div className="h-40 overflow-y-auto rounded-lg border border-teal-500/15 bg-black/40 p-3 text-sm leading-relaxed text-slate-400">
                <p className="mb-2">株式会社MRT（以下「甲」という。）と録画配信視聴者（以下「乙」という。）は，乙が甲から開示された情報（以下「機密情報」という。）の取扱いについて次のとおり契約（以下「本契約」という。）を締結する。</p>
                <p className="mb-1 font-semibold text-slate-300">第１条（機密情報）</p>
                <p className="mb-2">本契約において機密情報とは，甲が乙に対して，書面，口頭，電子メールその他方法を問わず開示した技術上または営業上の情報をいう。ただし，次の各号の一に該当する情報については，機密情報に含まれない。<br />・甲から開示を受けた時点で既に公知であった情報<br />・乙が正当な権限を有する第三者から機密保持義務を負うことなく取得した情報<br />・甲から開示を受けた後，乙の責に帰すべき事由によらないで公知になった情報</p>
                <p className="mb-1 font-semibold text-slate-300">第２条（秘密保持義務）</p>
                <p className="mb-2">乙は，機密情報を第三者に開示し，または漏えいしてはならない。ただし，次の各号の一に該当する場合は，この限りでない。<br />（１）乙が機密情報の開示につき事前の甲から書面による同意を受けた場合<br />（２）乙が法令上の義務に基づいて裁判所，官公庁その他の公的機関に機密情報を開示する場合<br />乙は，前項第１号または第２号に基づいて機密情報を開示するに先立ち，当該開示を受ける者が甲に対し本契約と同等の機密保持義務負うことを確約する書面を，甲に提出しなければならない。<br />乙は，第１項第１号または第２号に基づいて機密情報を第三者に開示した場合であっても，当該第三者による機密情報の管理利用その他の取扱いについて責任を負う。</p>
                <p className="mb-1 font-semibold text-slate-300">第３条（使用目的）</p>
                <p className="mb-2">乙は，機密情報を，甲と乙の取引に必要な範囲のみに使用し、これ以外の目的に使用してはならない。</p>
                <p className="mb-1 font-semibold text-slate-300">第４条（複製）</p>
                <p className="mb-2">乙は，書面による甲の承諾を事前に受けることなく，機密情報を複製または複写してはならない。</p>
                <p className="mb-1 font-semibold text-slate-300">第５条（差止請求，損害賠償等）</p>
                <p className="mb-2">甲は，乙が本契約に違反した場合，乙に対して，機密情報の使用を差し止めることができる。<br />乙は，本契約に違反して甲に損害を与えた場合，損害の拡大防止のため適切な措置を採るとともに，その損害を賠償しなければならない。</p>
                <p className="mb-1 font-semibold text-slate-300">第６条（知的財産権）</p>
                <p className="mb-2">相手方への秘密情報の開示は、機密情報に含まれる開示者又は第三者のいかなる知的財産権も受領者に移転し又は許諾するものではないことを確認する。</p>
                <p className="mb-1 font-semibold text-slate-300">第７条（契約上の地位移転等の禁止）</p>
                <p className="mb-2">甲及び乙は、本契約上の地位並びに本契約から生じる権利及び義務を相手方の事前の書面による承諾を得ずに、第三者に譲渡もしくは移転し又は第三者のための担保に供する等の一切の処分をしてはならない。</p>
                <p className="mb-1 font-semibold text-slate-300">第８条（有効期間）</p>
                <p className="mb-2">本契約に基づく機密保持義務は、本契約終了後も、機密情報が秘密である間は、存続するものとする。</p>
                <p className="mb-1 font-semibold text-slate-300">第９条（専属的合意管轄裁判所）</p>
                <p className="mb-2">本契約に関する紛争については，日本国法に準拠し、甲の指定する裁判所を第一審の専属的合意管轄裁判所とする。</p>
                <p className="mb-1 font-semibold text-slate-300">第10条（返還・廃棄）</p>
                <p className="mb-2">甲の請求があった場合，乙は機密情報及びその複製物を直ちに返還又は廃棄し，その旨を甲に通知する。</p>
                <p className="mt-3 text-slate-300">以上、乙が当社所定の機密保持締結画面において「機密保持契約に同意する」にチェックを入れた上で、「登録する」ボタンを押下した時点で、本契約は成立する。</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="border-teal-500/40 data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600"
                />
                <span className="select-none text-sm text-slate-300">機密保持契約に同意する</span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-base text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-600 text-base font-semibold text-white hover:from-teal-500 hover:via-cyan-400 hover:to-teal-500"
              disabled={isLoading || !agreed}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登録中...
                </>
              ) : (
                "登録する"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          © MRT inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
