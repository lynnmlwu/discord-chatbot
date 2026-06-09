import { config } from '../config.js';

/**
 * 短期對話記憶管理
 * 以頻道為單位，保存最近 N 條對話上下文
 */
class MemoryManager {
  constructor() {
    /** @type {Map<string, Array<{role: string, content: string}>>} */
    this.channels = new Map();
    this.maxMessages = config.memory.maxMessages;
  }

  /**
   * 取得某頻道的對話歷史
   * @param {string} channelId
   * @returns {Array<{role: string, content: string}>}
   */
  getHistory(channelId) {
    return this.channels.get(channelId) || [];
  }

  /**
   * 新增一條對話記錄
   * @param {string} channelId
   * @param {'user'|'model'} role
   * @param {string} content
   */
  addMessage(channelId, role, content) {
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, []);
    }

    const history = this.channels.get(channelId);
    history.push({ role, content });

    // 超過上限就從最舊的開始刪，保持成對刪除
    while (history.length > this.maxMessages * 2) {
      history.shift();
      history.shift();
    }
  }

  /**
   * 清除某頻道的記憶
   * @param {string} channelId
   */
  clear(channelId) {
    this.channels.delete(channelId);
  }
}

export const memory = new MemoryManager();
