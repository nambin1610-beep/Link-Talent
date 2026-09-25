import { SCHEMA_VERSION } from './constants.js';
import { hmacHex, randomHex, uuid } from './crypto.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ký một request theo hợp đồng của Apps Script (Auth.gs). */
export async function signRequest({ userId, secret }, action, payloadObj, requestId = uuid(), nowSec = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(payloadObj ?? {});
  const nonce = randomHex(16);
  const sig = await hmacHex(secret, `${nowSec}\n${nonce}\n${payload}`);
  return { v: SCHEMA_VERSION, action, request_id: requestId, auth: { user_id: userId, ts: nowSec, nonce, sig }, payload };
}

/**
 * Gọi Web App. Lỗi retryable được thử lại tối đa 4 lần (2s, 4s, 8s, 16s), CÙNG request_id
 * để Apps Script trả kết quả cũ nếu lần trước đã ghi (idempotent), nhưng ký lại với nonce mới.
 */
export async function callApi(settings, action, payloadObj, { requestId = uuid(), fetchImpl = fetch, maxRetries = 4, backoffMs = 2000 } = {}) {
  if (!settings?.endpoint || !settings?.userId || !settings?.secret) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Chưa cấu hình endpoint/user/secret trong Options', retryable: false } };
  }
  let res;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const body = await signRequest(settings, action, payloadObj, requestId);
    try {
      const r = await fetchImpl(settings.endpoint, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      const text = await r.text();
      try {
        res = JSON.parse(text);
      } catch {
        res = { ok: false, error: { code: 'BAD_RESPONSE', message: 'Phản hồi không phải JSON (kiểm tra quyền truy cập Web App: Anyone)', retryable: false } };
      }
    } catch (e) {
      res = { ok: false, error: { code: 'NETWORK', message: String(e?.message || e), retryable: true } };
    }
    if (res.ok || !res.error?.retryable || attempt === maxRetries) break;
    await sleep(backoffMs * 2 ** attempt);
  }
  return res;
}

export async function health(endpoint, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=health', { redirect: 'follow' });
    return JSON.parse(await r.text());
  } catch (e) {
    return { ok: false, error: { code: 'NETWORK', message: String(e?.message || e) } };
  }
}
