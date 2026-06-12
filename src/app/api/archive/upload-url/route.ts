import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createSimpleUploadUrl,
  createMultipartUpload,
  createPartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from "@/lib/r2";

// マルチパートに切り替えるサイズ閾値（100MB）
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
// 1パートのサイズ（100MB）
const PART_SIZE = 100 * 1024 * 1024;

// 管理者チェック（Supabase Authセッション + admin_users）
async function verifyAdmin(): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", session.user.id)
    .single();
  return !!admin;
}

// R2アップロードURL発行（管理者専用）
// action: "init" | "complete" | "abort"
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as string;

    // アップロード開始：ファイルサイズに応じて単一PUT or マルチパート
    if (action === "init") {
      const { file_name, file_size, content_type, kind } = body as {
        file_name?: string;
        file_size?: number;
        content_type?: string;
        kind?: "video" | "thumbnail";
      };
      if (!file_name || !file_size || !content_type) {
        return NextResponse.json(
          { error: "file_name, file_size, content_type が必要です" },
          { status: 400 }
        );
      }

      // R2キー生成（種別プレフィックス + タイムスタンプ + サニタイズ済みファイル名）
      const prefix = kind === "thumbnail" ? "thumbnails" : "videos";
      const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const r2Key = `${prefix}/${Date.now()}-${safeName}`;

      if (file_size <= MULTIPART_THRESHOLD) {
        // 単一PUT
        const url = await createSimpleUploadUrl(r2Key, content_type);
        return NextResponse.json({ mode: "simple", r2_key: r2Key, url });
      }

      // マルチパート：uploadId + 各パートの署名付きURLを返す
      const uploadId = await createMultipartUpload(r2Key, content_type);
      const partCount = Math.ceil(file_size / PART_SIZE);
      const partUrls: string[] = [];
      for (let i = 1; i <= partCount; i++) {
        partUrls.push(await createPartUploadUrl(r2Key, uploadId, i));
      }
      return NextResponse.json({
        mode: "multipart",
        r2_key: r2Key,
        upload_id: uploadId,
        part_size: PART_SIZE,
        part_urls: partUrls,
      });
    }

    // マルチパート完了
    if (action === "complete") {
      const { r2_key, upload_id, parts } = body as {
        r2_key?: string;
        upload_id?: string;
        parts?: { ETag: string; PartNumber: number }[];
      };
      if (!r2_key || !upload_id || !parts?.length) {
        return NextResponse.json({ error: "パラメータ不足です" }, { status: 400 });
      }
      await completeMultipartUpload(r2_key, upload_id, parts);
      return NextResponse.json({ ok: true });
    }

    // マルチパート中断
    if (action === "abort") {
      const { r2_key, upload_id } = body as { r2_key?: string; upload_id?: string };
      if (!r2_key || !upload_id) {
        return NextResponse.json({ error: "パラメータ不足です" }, { status: 400 });
      }
      await abortMultipartUpload(r2_key, upload_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "不明なactionです" }, { status: 400 });
  } catch (err) {
    console.error("Upload URL error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
