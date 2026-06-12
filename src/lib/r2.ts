/**
 * Cloudflare R2 クライアント（S3互換API）
 * 動画の署名付きURL生成・アップロードURL発行に使用
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2クライアント（シングルトン）
let r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

const BUCKET = () => process.env.R2_BUCKET_NAME!;

/**
 * 視聴用の署名付きURL（GET）を生成
 * 有効期限: 7200秒（2時間）
 */
export async function createPlaybackUrl(r2Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: r2Key });
  return getSignedUrl(getR2Client(), command, { expiresIn: 7200 });
}

/**
 * 単一PUTアップロード用の署名付きURLを生成（小さいファイル用）
 * 有効期限: 3600秒（1時間）
 */
export async function createSimpleUploadUrl(
  r2Key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: r2Key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: 3600 });
}

/**
 * マルチパートアップロードを開始し、uploadIdを返す（大容量動画用）
 */
export async function createMultipartUpload(
  r2Key: string,
  contentType: string
): Promise<string> {
  const result = await getR2Client().send(
    new CreateMultipartUploadCommand({
      Bucket: BUCKET(),
      Key: r2Key,
      ContentType: contentType,
    })
  );
  return result.UploadId!;
}

/**
 * 各パートのアップロード用署名付きURLを生成
 * 有効期限: 7200秒（2時間）
 */
export async function createPartUploadUrl(
  r2Key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: BUCKET(),
    Key: r2Key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: 7200 });
}

/**
 * マルチパートアップロードを完了
 */
export async function completeMultipartUpload(
  r2Key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
  await getR2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET(),
      Key: r2Key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

/**
 * マルチパートアップロードを中断
 */
export async function abortMultipartUpload(
  r2Key: string,
  uploadId: string
): Promise<void> {
  await getR2Client().send(
    new AbortMultipartUploadCommand({
      Bucket: BUCKET(),
      Key: r2Key,
      UploadId: uploadId,
    })
  );
}

/**
 * R2上のオブジェクトを削除
 */
export async function deleteR2Object(r2Key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: r2Key })
  );
}
