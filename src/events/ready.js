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

  updateStatus();
  setInterval(updateStatus, 60000); // 每分鐘更新一次
}
