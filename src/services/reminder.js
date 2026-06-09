/**
 * 排程提醒模組
 * 每天台灣時間 23:30 提醒玩家用完金幣秘窟 / Coin Cave 次數
 */

const TW_OFFSET_MS = 8 * 60 * 60 * 1000;
const DUNGEON_NAME = Object.freeze({
  zh: '金幣秘窟',
  en: 'Coin Cave',
});

function buildReminderTargets(targets) {
  return [
    {
      name: 'zh',
      channelId: targets?.zh,
      message: [
        `✨ **【${DUNGEON_NAME.zh}提醒】** ✨`,
        `（長耳朵輕輕晃）嗚... 今天的 **${DUNGEON_NAME.zh}** 次數還在等你喔。`,
        '如果還沒打完，可以慢慢去把它完成，不用著急。',
      ].join('\n'),
    },
    {
      name: 'en',
      channelId: targets?.en,
      message: [
        `✨ **[${DUNGEON_NAME.en} Reminder]** ✨`,
        `(ears sway softly) Mmm... today's **${DUNGEON_NAME.en}** attempts are still waiting for you.`,
        'If you still have runs left, you can finish them whenever you feel like it.',
      ].join('\n'),
    },
  ].filter((target) => target.channelId);
}

/**
 * 計算距離下次台灣時間 23:30 還有多少毫秒
 */
function msUntilNextReminder() {
  const now = new Date();
  const twNow = new Date(now.getTime() + TW_OFFSET_MS);

  const target = new Date(twNow);
  target.setUTCHours(15, 30, 0, 0); // UTC 15:30 = TW 23:30

  // 如果今天的 23:30 已經過了，改成明天
  if (target <= twNow) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target.getTime() - twNow.getTime();
}

/**
 * 啟動提醒排程
 * @param {import('discord.js').Client} client
 * @param {{ zh?: string, en?: string }} targets - 要發送提醒的頻道 ID
 */
export function startDungeonReminder(client, targets) {
  console.log(`[Reminder] Loaded updated reminder copy: ${DUNGEON_NAME.zh} / ${DUNGEON_NAME.en}`);

  const reminderTargets = buildReminderTargets(targets);

  if (reminderTargets.length === 0) {
    console.warn('[Reminder] 未設定 DUNGEON_REMINDER_CHANNEL_ID / DUNGEON_REMINDER_EN_CHANNEL_ID，跳過提醒排程');
    return;
  }

  function scheduleNext() {
    const ms = msUntilNextReminder();
    console.log(`[Reminder] 下次${DUNGEON_NAME.zh}提醒將在 ${Math.round(ms / 60000)} 分鐘後發送`);

    setTimeout(async () => {
      try {
        for (const target of reminderTargets) {
          const channel = await client.channels.fetch(target.channelId);
          if (channel?.isTextBased()) {
            await channel.send(target.message);
            console.log(`[Reminder] ${target.name} reminder sent!`);
          }
        }
      } catch (err) {
        console.error('[Reminder] 發送提醒失敗：', err.message);
      }

      // 排程下一次（24 小時後）
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}
