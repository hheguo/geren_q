const app = getApp();

Page({
  data: {
    nickname: '',
    baseScore: '',
    playerCount: '',
    isTaiban: false,
    loading: false,
    showLogin: false
  },

  onLoad() {
    this.setData({ nickname: app.globalData.nickname || '' });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onBaseScoreInput(e) {
    this.setData({ baseScore: e.detail.value });
  },

  onCountInput(e) {
    this.setData({ playerCount: e.detail.value });
  },

  onTaibanChange(e) {
    this.setData({ isTaiban: e.detail.value });
  },

  async doCreate() {
    // 防重复点击
    if (this.data.loading) return;

    // 1. 检查登录
    if (!app.globalData.isLoggedIn) {
      this.setData({ showLogin: true });
      return;
    }

    this.setData({ loading: true });

    const { nickname, isTaiban } = this.data;
    const name = app.globalData.nickname || nickname.trim() || '玩家1';
    const baseScore = parseInt(this.data.baseScore) || 1;
    const playerCount = 4; // 固定为 4 人 (台版逻辑在 Room 页处理)
    
    // 确保昵称更新
    app.globalData.nickname = name;
    app.saveUser();

    const rules = JSON.stringify({ baseScore, playerCount });
    const scoreMode = isTaiban ? 1 : 0;

    // 设置 3 秒超时 — 超时直接走离线
    const timeout = (ms) => new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    );

    try {
      // 获取当前用户ID (应该已经在 auth-modal 中登录了，或者之前已登录)
      // 双重保险：如果没有 userId，再尝试一次 mock login
      if (!app.globalData.userId) {
         app.globalData.userId = 'wx_' + Date.now();
      }
      
      const userId = app.globalData.userId;

      // 创建房间 — 加超时
      const room = await Promise.race([
        app.request('/room/create', {
          method: 'POST',
          data: { ownerId: userId, rules, scoreMode }
        }),
        timeout(3000)
      ]);

      app.globalData.currentRoom = room;
      app.initPlayers(playerCount, name, app.globalData.userId);

      this.setData({ loading: false });
      
      // 使用后端返回的 roomCode (UUID)
      wx.navigateTo({
        url: `/pages/room/room?code=${room.roomCode}`
      });
    } catch (e) {
      console.warn('后端不可用或超时，使用离线模式:', e.message);
      // 离线模式暂不支持台版逻辑的完整后端特性，但在前端可以模拟
      app.globalData.currentRoom = {
        id: Date.now(),
        roomCode: app.generateRoomCode(), // 离线还是用短码? 或者也模拟 UUID? 这里先保留短码
        ownerId: 1,
        status: 0,
        rules,
        scoreMode
      };
      app.initPlayers(playerCount, name, app.globalData.userId);

      this.setData({ loading: false });
      wx.navigateTo({
        url: `/pages/room/room?code=${app.globalData.currentRoom.roomCode}`
      });
    }
  },

  onLoginSuccess() {
    this.setData({ showLogin: false });
    this.doCreate(); // 登录成功后自动重试
  },

  onLoginCancel() {
    this.setData({ showLogin: false });
  }
});
