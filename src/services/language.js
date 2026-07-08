/**
 * 頻道語言偵測模組
 * 根據頻道名稱或分類名稱判斷應使用中文或英文
 */

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * 判斷頻道應使用的語言
 * @param {import('discord.js').TextChannel} channel
 * @returns {'zh'|'en'}
 */
export function detectLanguage(channel) {
  const nameLower = channel.name.toLowerCase();
  
  // 1. 優先檢查是否為明確的英文頻道
  const enKeywords = ['english', 'en-', 'en_', 'eng'];
  if (enKeywords.some((kw) => nameLower.includes(kw))) {
    return 'en';
  }

  // 2. 檢查分類名稱（Category）是否為英文類別
  const parentNameLower = channel.parent?.name?.toLowerCase() || '';
  if (enKeywords.some((kw) => parentNameLower.includes(kw))) {
    return 'en';
  }

  // 3. 檢查頻道名稱是否含中文字
  if (CJK_REGEX.test(channel.name)) {
    return 'zh';
  }

  // 4. 檢查分類名稱（Category）是否含中文字
  if (channel.parent?.name && CJK_REGEX.test(channel.parent.name)) {
    return 'zh';
  }

  // 5. 如果都無法判斷，預設英文
  return 'en';
}
