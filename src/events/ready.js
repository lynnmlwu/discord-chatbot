/**
 * Bot 上線事件
 * @param {import('discord.js').Client} client
 */
export function onReady(client) {
  console.log(`✨ ${client.user.tag} 已上線！正在 ${client.guilds.cache.size} 個伺服器中發光～`);
  
  function updateStatus() {
    const now = new Date();
    const twTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const day = twTime.getUTCDay();
    const hour = twTime.getUTCHours();
    
    const isWorking = (day >= 1 && day <= 5) && (hour >= 10 && hour < 19);
    
    if (isWorking) {
      client.user.setPresence({
        activities: [{ name: '🟢 聽著心源地的聲音 (營業中)', type: 0 }],
        status: 'online',
      });
    } else {
      // 計算下一次營業時間（隔天 10:00 台灣時間）
      const nextWorkTime = new Date(twTime);
      if (day === 5) {
        // 週五下班，下次營業是週一 10:00
        nextWorkTime.setUTCDate(nextWorkTime.getUTCDate() + (8 - day));
      } else {
        // 其他時間，下次營業是隔天 10:00
        nextWorkTime.setUTCDate(nextWorkTime.getUTCDate() + 1);
      }
      nextWorkTime.setUTCHours(2, 0, 0, 0); // 隔天 10:00 (UTC+8)
      const timestamp = Math.floor(nextWorkTime.getTime() / 1000);
      
      client.user.setPresence({
        activities: [{ name: `💤 休息到 <t:${timestamp}:R>`, type: 0 }],
        status: 'idle',
      });
    }
  }

  updateStatus();
  setInterval(updateStatus, 60000); // 每分鐘更新一次
}
