#!/usr/bin/env python3
"""上传构建资产到 Gitee Release（幂等 + per-file 重试）。

由 .github/workflows/release-gitee-sync.yml 在 gitee_create_release.py 之后调用。
遍历 ./assets/*（跳过 GitHub 版 latest.json 与已存在同名附件），逐个 multipart 上传到
Gitee Release 的 attach_files。

失败语义：任一文件重试耗尽仍失败 → exit 非 0 → 步骤红（release 缺资产会让 manifest 改写失败，必须暴露）。
唯一非致命点：「拉已有附件去重」的 fetch 失败 → 仅 warning 降级（非核心优化，失败只是不去重）。

输入（环境变量）：
  GITEE_OWNER   Gitee 组织/用户名（job 级）
  GITEE_REPO    Gitee 仓库名（job 级）
  GITEE_TOKEN   Gitee 个人访问令牌（step 级）
  RELEASE_ID    Gitee Release ID（step 级，由 gitee_create_release.py 输出）

输入（文件）：
  ./assets/*    gh release download 下载的全部资产

说明：access_token 放 multipart form field（Gitee v5 鉴权坑，绝不放 header）。
"""
import glob
import json
import os
import time
import urllib.error
import urllib.request
import uuid

RETRIES = 3
RETRY_DELAY = 5  # 秒
UPLOAD_TIMEOUT = 300  # 单次上传超时（大文件 dmg ~50MB）


def _read_json(resp):
    """读取响应体并解析 JSON。空 body / 非 JSON（如 Gitee 偶发的 HTML 错误页）→ 返回 None。"""
    raw = resp.read().decode("utf-8", errors="replace")
    if not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _build_multipart(fields, file_path, file_name):
    """构造 multipart/form-data body。fields: [(name, value)]；返回 (body_bytes, content_type)。"""
    boundary = f"----GiteeUpload{uuid.uuid4().hex}"
    crlf = b"\r\n"
    parts = []
    for name, value in fields:
        parts.append(f"--{boundary}".encode())
        parts.append(crlf)
        parts.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        parts.append(crlf + crlf)
        parts.append(str(value).encode())
        parts.append(crlf)
    parts.append(f"--{boundary}".encode())
    parts.append(crlf)
    parts.append(
        f'Content-Disposition: form-data; name="file"; filename="{file_name}"'.encode()
    )
    parts.append(crlf)
    parts.append(b"Content-Type: application/octet-stream")
    parts.append(crlf + crlf)
    with open(file_path, "rb") as fh:
        parts.append(fh.read())
    parts.append(crlf)
    parts.append(f"--{boundary}--".encode())
    parts.append(crlf)
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def upload_one(upload_url, token, name, path):
    """上传单个文件，带重试。返回 True 成功 / False 最终失败。"""
    # access_token 放 form field（Gitee v5 鉴权坑）
    body, content_type = _build_multipart(
        [("access_token", token), ("name", name)], path, name
    )
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(
                upload_url, data=body, method="POST", headers={"Content-Type": content_type}
            )
            with urllib.request.urlopen(req, timeout=UPLOAD_TIMEOUT) as resp:
                resp.read()
                print(f"  HTTP {resp.status} Uploaded {name}")
                return True
        except urllib.error.HTTPError as e:
            # 4xx 客户端错误不重试；5xx 服务端错误重试
            if e.code >= 500 and attempt < RETRIES:
                print(f"    {name}: HTTP {e.code}, retry {attempt}/{RETRIES}...")
                time.sleep(RETRY_DELAY)
                continue
            print(f"::error::Failed to upload {name}: HTTP {e.code}")
            return False
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            # 网络层错误（DNS / 超时 / 连接拒绝）重试
            if attempt < RETRIES:
                print(f"    {name}: network error, retry {attempt}/{RETRIES}...")
                time.sleep(RETRY_DELAY)
                continue
            print(f"::error::Failed to upload {name}: {e}")
            return False
    return False


def main() -> None:
    owner = os.environ["GITEE_OWNER"]
    repo = os.environ["GITEE_REPO"]
    token = os.environ["GITEE_TOKEN"]
    release_id = os.environ["RELEASE_ID"]
    base = f"https://gitee.com/api/v5/repos/{owner}/{repo}"
    upload_url = f"{base}/releases/{release_id}/attach_files"

    # 幂等：拉已有附件名集合，re-run 时跳过已存在同名文件。
    # 此 fetch 为非核心优化 —— 失败仅降级为不去重，不废整个上传。
    existing = set()
    try:
        with urllib.request.urlopen(
            f"{base}/releases/{release_id}?access_token={token}"
        ) as r:
            rel = _read_json(r)
        if not isinstance(rel, dict):
            raise RuntimeError(f"non-object response: {rel!r:.100}")
        assets = rel.get("assets") or rel.get("attach_files") or []
        existing = {a.get("name", "") for a in assets if isinstance(a, dict)}
    except Exception as e:
        print(f"::warning::Failed to fetch existing assets (dedup disabled): {type(e).__name__}: {e}")

    failed = []
    for path in sorted(glob.glob("./assets/*")):
        name = os.path.basename(path)
        # 跳过 GitHub 版 latest.json —— Gitee 专属 manifest 由 gitee_rewrite_manifest.py 单独生成
        if name == "latest.json":
            continue
        if name in existing:
            print(f"  Skip {name} (already attached)")
            continue
        if not upload_one(upload_url, token, name, path):
            failed.append(name)

    # 任一文件重试耗尽仍失败 → 视为步骤失败（release 缺资产会让 manifest 改写失败）
    if failed:
        print(f"::error::{len(failed)} asset(s) failed to upload after retries: {failed}", flush=True)
        raise SystemExit(1)


if __name__ == "__main__":
    # 真异常直接抛出 → exit 非 0 → 步骤红，绝不静默吞掉
    main()
