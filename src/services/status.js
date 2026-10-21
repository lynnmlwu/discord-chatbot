/**
 * Bot 狀態管理：依上班時間和 Groq 額度切換「聆聽中 / 休息中」
 */

const DEFAULT_REST_MS = 10 * 60 * 1000; // 抓不到等待時間時，預設休息 10 分鐘

let restingUntil = 0; // 額度用完時，休息到這個時間點
let client = null;

/** 是否在上班時間（台灣時間 週一到週五 10:00~19:00） */
export function isWorkingHours() {
  const twTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = twTime.getUTCDay();
  const hour = twTime.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 10 && hour < 19;
}

/** 是否因為額度用完而在休息 */
export function isRateLimited() {
  return Date.now() < restingUntil;
}

/**
 * 從 Groq 429 錯誤算出要休息多久
 * 優先用 retry-after header，否則解析訊息裡的「try again in 11m47.6s」
 */
function getRetryMs(error) {
  const header = error.headers?.get?.('retry-after');
  if (header && !isNaN(Number(header))) return Number(header) * 1000;

  const match = error.message?.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/);
  if (match && (match[1] || match[2] || match[3])) {
    const [, h = 0, m = 0, s = 0] = match;
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
  }
  return DEFAULT_REST_MS;
}

/** 額度用完時呼叫：切換成休息狀態，時間到自動恢復 */
export function enterRateLimitRest(error) {
  const ms = getRetryMs(error);
  restingUntil = Date.now() + ms;
  console.log(`[Status] 額度用完，休息 ${Math.ceil(ms / 60000)} 分鐘`);
  updateStatus();
  setTimeout(updateStatus, ms + 1000);
}

/** 依目前狀況更新 Discord 狀態 */
export function updateStatus() {
  if (!client?.user) return;

  if (isWorkingHours() && !isRateLimited()) {
    client.user.setPresence({
      activities: [{ name: '🟢 Listening to Emovia voices', type: 0 }],
      status: 'online',
    });
  } else {
    client.user.setPresence({
      activities: [{ name: '💤 Resting', type: 0 }],
      status: 'idle',
    });
  }
}

/** 啟動狀態更新：立即更新一次，之後每分鐘檢查 */
export function startStatus(discordClient) {
  client = discordClient;
  updateStatus();
  setInterval(updateStatus, 60000);
}
