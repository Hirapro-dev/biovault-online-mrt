"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ArchiveMember } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { archiveGroupLabel, ARCHIVE_GROUPS, ARCHIVE_GROUP_LABELS } from "@/lib/archive-group";
import { Download, Search, UserPlus, ExternalLink, Loader2, X, Pencil, Trash2, Save } from "lucide-react";

// 管理画面：録画配信 会員一覧
export default function ArchiveMembersPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState<ArchiveMember[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 新規登録フォームの状態
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKana, setFormKana] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGroup, setFormGroup] = useState<"a" | "b">("a");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issued, setIssued] = useState<{ id: string; pw: string } | null>(null);

  // 編集中の会員（null なら編集していない）
  const [editMember, setEditMember] = useState<ArchiveMember | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("archive_members")
      .select("*")
      .order("created_at", { ascending: false });
    setMembers((data as ArchiveMember[]) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // 管理者による会員の手動登録（既存の登録APIを利用）
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIssued(null);
    try {
      const res = await fetch("/api/archive/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          name_kana: formKana,
          phone: formPhone,
          email: formEmail,
          address: formAddress,
          member_group: formGroup,
          confidentiality_agreed: true,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "登録に失敗しました");

      setIssued({ id: result.member_id, pw: result.password });
      toast({ title: `会員を登録しました（ID: ${result.member_id}）` });
      // フォームをクリアして一覧を更新
      setFormName("");
      setFormKana("");
      setFormPhone("");
      setFormEmail("");
      setFormAddress("");
      setFormGroup("a");
      fetchMembers();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "登録に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 会員情報の更新
  const handleUpdate = async () => {
    if (!editMember) return;
    setIsUpdating(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("archive_members")
      .update({
        name: editMember.name.trim(),
        name_kana: editMember.name_kana.trim(),
        phone: editMember.phone.trim(),
        email: editMember.email.trim(),
        address: editMember.address.trim(),
        password: editMember.password.trim(),
        member_group: editMember.member_group,
        is_active: editMember.is_active,
      })
      .eq("id", editMember.id);
    setIsUpdating(false);
    if (error) {
      toast({ title: "更新に失敗しました", variant: "destructive" });
    } else {
      toast({ title: "会員情報を更新しました" });
      setEditMember(null);
      fetchMembers();
    }
  };

  // 会員の削除（視聴ログ・再生履歴も併せて削除）
  const handleDelete = async (m: ArchiveMember) => {
    if (!confirm(`「${m.name}」さんを削除しますか？\n視聴ログ・再生履歴も削除されます。`)) return;
    const supabase = createClient();
    // 外部キー参照を先に削除
    await supabase.from("archive_play_logs").delete().eq("member_id", m.member_id);
    await supabase.from("archive_views").delete().eq("member_id", m.member_id);
    const { error } = await supabase.from("archive_members").delete().eq("id", m.id);
    if (error) {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    } else {
      toast({ title: "会員を削除しました" });
      if (editMember?.id === m.id) setEditMember(null);
      fetchMembers();
    }
  };

  const filtered = members.filter(
    (m) =>
      m.name.includes(search) ||
      m.name_kana.includes(search) ||
      m.member_id.includes(search) ||
      m.email.includes(search) ||
      m.phone.includes(search)
  );

  // CSV出力
  const handleExportCsv = () => {
    const header = "視聴ID,流入元,氏名,かな,電話番号,メール,住所,機密保持同意,登録日時";
    const rows = filtered.map((m) =>
      [
        m.member_id,
        archiveGroupLabel(m.member_group),
        m.name,
        m.name_kana,
        m.phone,
        m.email,
        `"${m.address.replace(/"/g, '""')}"`,
        m.confidentiality_agreed ? "同意済" : "未同意",
        new Date(m.created_at).toLocaleString("ja-JP"),
      ].join(",")
    );
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive_members_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">録画配信 会員一覧</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            CSV出力
          </Button>
          {/* ユーザー向け登録フォーム（グループ別）を新しいタブで開く */}
          <a href="/archive/register/a" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              登録フォーム（{ARCHIVE_GROUP_LABELS.a}）
            </Button>
          </a>
          <a href="/archive/register/b" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              登録フォーム（{ARCHIVE_GROUP_LABELS.b}）
            </Button>
          </a>
          {/* ログインページを新しいタブで開く */}
          <a href="/archive/login" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              ログインページ
            </Button>
          </a>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showForm ? "閉じる" : "新規登録"}
          </Button>
        </div>
      </div>

      {/* 管理者による手動登録フォーム */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">会員の新規登録</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>氏名 *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="山田 太郎"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ふりがな *</Label>
                  <Input
                    value={formKana}
                    onChange={(e) => setFormKana(e.target.value)}
                    placeholder="やまだ たろう"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>電話番号 *</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="09012345678"
                    maxLength={11}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>メールアドレス *</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="example@example.com"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>住所 *</Label>
                  <Input
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="東京都〇〇区〇〇 1-2-3"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>流入元 *</Label>
                  <select
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value as "a" | "b")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {ARCHIVE_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {ARCHIVE_GROUP_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 発行されたID/PWの表示 */}
              {issued && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm">
                  <p className="font-medium text-green-700">登録が完了しました</p>
                  <p className="mt-1 font-mono">
                    視聴ID: <span className="font-bold">{issued.id}</span> ／ パスワード:{" "}
                    <span className="font-bold">{issued.pw}</span>
                  </p>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    登録中...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    登録する
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 会員編集フォーム */}
      {editMember && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>会員情報の編集</span>
              <span className="font-mono text-sm text-muted-foreground">
                {editMember.member_id}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>氏名</Label>
                <Input
                  value={editMember.name}
                  onChange={(e) => setEditMember({ ...editMember, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ふりがな</Label>
                <Input
                  value={editMember.name_kana}
                  onChange={(e) => setEditMember({ ...editMember, name_kana: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>電話番号</Label>
                <Input
                  value={editMember.phone}
                  onChange={(e) => setEditMember({ ...editMember, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>メールアドレス</Label>
                <Input
                  type="email"
                  value={editMember.email}
                  onChange={(e) => setEditMember({ ...editMember, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>住所</Label>
                <Input
                  value={editMember.address}
                  onChange={(e) => setEditMember({ ...editMember, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>パスワード</Label>
                <Input
                  value={editMember.password}
                  onChange={(e) => setEditMember({ ...editMember, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>流入元</Label>
                <select
                  value={editMember.member_group}
                  onChange={(e) =>
                    setEditMember({ ...editMember, member_group: e.target.value as "a" | "b" })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {ARCHIVE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {ARCHIVE_GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editMember.is_active}
                    onChange={(e) => setEditMember({ ...editMember, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  有効（チェックを外すとログイン不可）
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleUpdate} disabled={isUpdating} className="gap-2">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存
              </Button>
              <Button variant="outline" onClick={() => setEditMember(null)} className="gap-2">
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            登録会員（{filtered.length}名）
          </CardTitle>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="氏名・ID・電話・メールで検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">会員がいません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">視聴ID</th>
                    <th className="px-2 py-2">流入元</th>
                    <th className="px-2 py-2">氏名</th>
                    <th className="px-2 py-2">かな</th>
                    <th className="px-2 py-2">電話番号</th>
                    <th className="px-2 py-2">メール</th>
                    <th className="px-2 py-2">住所</th>
                    <th className="px-2 py-2">登録日時</th>
                    <th className="px-2 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-muted/50">
                      <td className="px-2 py-2 font-mono">{m.member_id}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.member_group === "b"
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-teal-500/10 text-teal-600"
                          }`}
                        >
                          {archiveGroupLabel(m.member_group)}
                        </span>
                      </td>
                      <td className="px-2 py-2">{m.name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{m.name_kana}</td>
                      <td className="px-2 py-2">{m.phone}</td>
                      <td className="px-2 py-2">{m.email}</td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-muted-foreground">
                        {m.address}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditMember({ ...m })}
                            title="編集"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(m)}
                            title="削除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
