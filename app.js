App({
  globalData: {
    // 后端 API 地址 — 本地调试用 localhost
    // apiBase: 'http://47.98.143.197:8080/api',
    apiBase: 'https://tingpai.top/api',
    userId: null,
    nickname: '',
    avatarUrl: '',
    isLoggedIn: false,
    currentRoom: null,
    players: [],
    records: [],
    roomHistory: [],
    theme: 'dark'  // 'dark' | 'light'
  },

  onLaunch() {
    const saved = wx.getStorageSync('tenpai_user');
    if (saved) {
      this.globalData.userId = saved.userId;
      this.globalData.nickname = saved.nickname || '';
      this.globalData.avatarUrl = saved.avatarUrl || '';
      this.globalData.isLoggedIn = !!saved.userId;
    }
    const history = wx.getStorageSync('tenpai_room_history');
    if (history) {
      this.globalData.roomHistory = history;
    }
    const theme = wx.getStorageSync('tenpai_theme');
    if (theme) {
      this.globalData.theme = theme;
    }
  },

  // ---------- API 封装 ----------
  request(path, options = {}) {
    const that = this;
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${that.globalData.apiBase}${path}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: { 'Content-Type': 'application/json' },
        success(res) {
          if (res.data && res.data.code === 200) {
            resolve(res.data.data);
          } else {
            reject(new Error(res.data ? res.data.msg : '请求失败'));
          }
        },
        fail() {
          reject(new Error('无法连接服务器'));
        }
      });
    });
  },

  // ---------- 工具方法 ----------
  saveUser() {
    wx.setStorageSync('tenpai_user', {
      userId: this.globalData.userId,
      nickname: this.globalData.nickname,
      avatarUrl: this.globalData.avatarUrl
    });
  },

  showToast(title, icon) {
    wx.showToast({ title, icon: icon || 'none', duration: 2000 });
  },

  generateRoomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  },

  initPlayers(count, ownerName, ownerId) {
    this.globalData.players = [{
      id: ownerId || Date.now(),
      name: ownerName,
      score: 0
    }];
    this.globalData.records = [];
  },

  // ---------- 房间历史 ----------
  saveRoomToHistory(room, players, records) {
    const history = this.globalData.roomHistory || [];
    history.unshift({
      roomCode: room.roomCode,
      rules: room.rules,
      players: players.map(p => ({ name: p.name, score: p.score })),
      recordCount: records.length,
      createTime: new Date().toISOString()
    });
    if (history.length > 50) history.length = 50;
    this.globalData.roomHistory = history;
    wx.setStorageSync('tenpai_room_history', history);
  },

  // ---------- 主题切换 ----------
  setTheme(theme) {
    this.globalData.theme = theme;
    wx.setStorageSync('tenpai_theme', theme);
  }
});
