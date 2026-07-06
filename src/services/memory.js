import { config } from '../config.js';

/**
 * 短期對話記憶管理
 * 以使用者為單位，保存最近 N 條對話上下文
 */
class MemoryManager {
  constructor() {
    /** @type {Map<string, Array<{role: string, content: string}>>} */
    this.users = new Map();
    this.maxMessages = config.memory.maxMessages;
  }

  /**
   * 取得某使用者的對話歷史
   * @param {string} userId
   * @returns {Array<{role: string, content: string}>}
   */
  getHistory(userId) {
    return this.users.get(userId) || [];
  }

  /**
   * 新增一條對話記錄
   * @param {string} userId
   * @param {'user'|'model'} role
   * @param {string} content
   */
  addMessage(userId, role, content) {
    if (!this.users.has(userId)) {
      this.users.set(userId, []);
    }

    const history = this.users.get(userId);
    history.push({ role, content });

    // 超過上限就從最舊的開始刪，保持成對刪除
    while (history.length > this.maxMessages * 2) {
      history.shift();
      history.shift();
    }
  }

  /**
   * 清除某使用者的記憶
   * @param {string} userId
   */
  clear(userId) {
    this.users.delete(userId);
  }
}

export const memory = new MemoryManager();
