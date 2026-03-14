function jsonHeaders(token) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export class FeishuClient {
  constructor(config) {
    this.config = config;
    this.cachedToken = null;
    this.cachedTokenExpiresAt = 0;
  }

  async getTenantAccessToken() {
    const now = Date.now();
    if (this.cachedToken && now < this.cachedTokenExpiresAt) {
      return this.cachedToken;
    }

    const response = await fetch(
      `${this.config.feishuBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          app_id: this.config.feishuAppId,
          app_secret: this.config.feishuAppSecret
        })
      }
    );

    const payload = await response.json();
    if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
      throw new Error(
        `Failed to fetch tenant_access_token: ${payload.msg || response.statusText}`
      );
    }

    this.cachedToken = payload.tenant_access_token;
    this.cachedTokenExpiresAt = now + Math.max(60, payload.expire - 60) * 1000;
    return this.cachedToken;
  }

  async sendText(chatId, text) {
    const token = await this.getTenantAccessToken();
    const response = await fetch(
      `${this.config.feishuBaseUrl}/open-apis/im/v1/messages?receive_id_type=chat_id`,
      {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text })
        })
      }
    );

    const payload = await response.json();
    if (!response.ok || payload.code !== 0) {
      throw new Error(`Failed to send Feishu message: ${payload.msg || response.statusText}`);
    }

    return payload;
  }
}
