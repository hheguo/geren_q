const app = getApp();

Page({
  data: {
    nickname: '',
    roomCode: '',
    loading: false,
    showLogin: false
  },

  onLoad() {
    this.setData({ nickname: app.globalData.nickname || '' });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onCodeInput(e) {
    // 仅保存数据，不强制写回 setData 避免光标跳动
    this.data.roomCode = e.detail.value;
  },

  parsePlayers(playersJson) {
    if (!playersJson) return [];
    try {
      const list = JSON.parse(playersJson);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  async syncJoinedPlayer(roomCode) {
    try {
      const detail = await app.request(`/room/${roomCode}`, { method: 'GET' });
      const room = detail && detail.room ? detail.room : null;
      if (!room || !room.id) return;

      const players = this.parsePlayers(room.players);
      const currentUserId = String(app.globalData.userId);
      const hasCurrentUser = players.some(p => String(p.id) === currentUserId);

      if (!hasCurrentUser) {
        players.push({
          id: currentUserId,
          name: app.globalData.nickname || '玩家',
          avatar: app.globalData.avatarUrl || ''
        });
      }

      app.globalData.currentRoom = room;
      app.globalData.players = players.map((p, index) => ({
        id: p.id,
        name: p.name || `玩家${index + 1}`,
        avatar: p.avatar || '',
        score: 0
      }));

      if (!hasCurrentUser) {
        await app.request('/room/update', {
          method: 'POST',
          data: {
            id: room.id,
            players: JSON.stringify(players.map(p => ({
              id: String(p.id),
              name: p.name || '玩家',
              avatar: p.avatar || ''
            })))
          }
        });
      }
    } catch (e) {
      // 降级：允许继续进入房间，房间页会再尝试加载
      console.warn('syncJoinedPlayer failed', e);
    }
  },

  async doJoin() {
    if (this.data.loading) return;
    
    // 1. 基础校验
    const roomCode = (this.data.roomCode || '').trim();
    if (!roomCode) {
      app.showToast('请输入邀请码');
      return;
    }
    // 兼容历史 UUID 房间 + 新版 6 位邀请码
    const isInviteCode = /^\d{6}$/.test(roomCode);
    const isLegacyUuid = /^[a-fA-F0-9]{32}$/.test(roomCode);
    if (!isInviteCode && !isLegacyUuid) {
      app.showToast('请输入6位邀请码');
      return;
    }

    // 2. 检查登录
    if (!app.globalData.isLoggedIn) {
      this.setData({ showLogin: true });
      return;
    }

    this.setData({ loading: true });

    try {
      const room = await app.request('/room/join', {
        method: 'POST',
        data: { roomCode }
      });

      app.globalData.currentRoom = room;

      let playerCount = 4;
      try {
        const rules = JSON.parse(room.rules || '{}');
        playerCount = rules.playerCount || 4;
      } catch (e) { /* ignore */ }

      // 初始化玩家数据
      const name = app.globalData.nickname || '玩家';
      app.initPlayers(playerCount, name, app.globalData.userId);
      await this.syncJoinedPlayer(room.roomCode);
      
      this.setData({ loading: false });
      
      wx.navigateTo({
        url: `/pages/room/room?code=${room.roomCode}`
      });
      
    } catch (e) {
      this.setData({ loading: false });
      app.showToast(e.message || '加入房间失败');
    }
  },

  onLoginSuccess() {
    this.setData({ showLogin: false });
    this.doJoin(); // 登录成功后自动重试
  },

  onLoginCancel() {
    this.setData({ showLogin: false });
  }
});
