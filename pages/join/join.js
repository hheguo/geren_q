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

  async doJoin() {
    if (this.data.loading) return;
    
    // 1. 基础校验
    const roomCode = this.data.roomCode || '';
    if (roomCode.length !== 4) {
      app.showToast('请输入4位房间号');
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
