import { startStatus } from '../services/status.js';

/**
 * Bot 上線事件
 * @param {import('discord.js').Client} client
 */
export function onReady(client) {
  console.log(`✨ ${client.user.tag} 已上線！正在 ${client.guilds.cache.size} 個伺服器中發光～`);
  startStatus(client); // 依上班時間和額度狀況切換狀態，每分鐘檢查
}
