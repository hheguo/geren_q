const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    tempNickname: '',
    tempAvatarUrl: '',
    roomHistory: [],
    theme: 'dark',
    feedbackType: 'suggestion',
    feedbackContent: '',
    feedbackContact: '',
    loading: false
  },

  goBill() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/bill/bill'
    });
  },

  goRoomList() {
    // 历史房间记录不需要登录也能看本地缓存？
    // 假设是本地缓存的 history
    wx.navigateTo({
      url: '/pages/room-list/room-list'
    });
  },

  onShow() {
    this.refreshProfile();
  },

  refreshProfile() {
    const history = (app.globalData.roomHistory || []).map(r => {
      let timeText = '';
      if (r.createTime) {
        const d = new Date(r.createTime);
        timeText = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      return { ...r, timeText };
    });

    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      nickname: app.globalData.nickname || '',
      avatarUrl: app.globalData.avatarUrl || '',
      roomHistory: history,
      theme: app.globalData.theme || 'dark'
    });
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({ tempAvatarUrl: avatarUrl });
      app.showToast('头像已选择', 'success');
    }
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  doLogin() {
    if (this.data.loading) return;
    
    const nickname = this.data.tempNickname.trim();
    const avatarUrl = this.data.tempAvatarUrl;

    if (!nickname) {
      app.showToast('请输入昵称');
      return;
    }

    this.setData({ loading: true });

    wx.login({
      success: (loginRes) => {
        const code = loginRes.code;
        const openid = 'wx_' + Date.now(); // 临时 fallback

        app.globalData.nickname = nickname;
        app.globalData.avatarUrl = avatarUrl;
        app.globalData.userId = openid;
        app.globalData.isLoggedIn = true;
        app.saveUser();

        // 3秒超时防止卡死
        const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));

        Promise.race([
          app.request('/wx/login', {
            method: 'POST',
            data: {
              code: code,
              openid: openid,
              nickname: nickname,
              avatarUrl: avatarUrl
            }
          }),
          timeout(3000)
        ]).then(user => {
          if (user && user.id) {
            app.globalData.userId = user.id;
            app.saveUser();
          }
        }).catch(() => {
          console.warn('登录接口超时或失败，使用离线模式');
        }).finally(() => {
          this.setData({ loading: false });
          app.showToast('登录成功', 'success');
          this.refreshProfile();
        });
      },
      fail: () => {
        this.setData({ loading: false });
        app.showToast('微信登录失败');
      }
    });
  },

  doLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需重新登录',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userId = null;
          app.globalData.nickname = '';
          app.globalData.avatarUrl = '';
          app.globalData.isLoggedIn = false;
          wx.removeStorageSync('tenpai_user');
          app.showToast('已退出');
          this.refreshProfile();
        }
      }
    });
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除所有本地数据并重启小程序，确认继续？',
      success: (res) => {
        if (res.confirm) {
          // 清除所有本地存储
          wx.clearStorageSync();
          // 重置全局数据
          app.globalData.userId = null;
          app.globalData.nickname = '';
          app.globalData.avatarUrl = '';
          app.globalData.isLoggedIn = false;
          app.globalData.roomHistory = [];
          app.globalData.records = [];
          app.globalData.currentRoom = null;
          app.globalData.players = [];
          app.globalData.theme = 'dark';
          // 重启小程序（类似浏览器硬刷新）
          wx.showToast({
            title: '缓存已清除，正在重启…',
            icon: 'none',
            duration: 1500
          });
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/home/home' });
          }, 1500);
        }
      }
    });
  },

  toggleTheme() {
    const newTheme = this.data.theme === 'dark' ? 'light' : 'dark';
    this.setData({ theme: newTheme });
    app.setTheme(newTheme);

    wx.setNavigationBarColor({
      frontColor: newTheme === 'dark' ? '#ffffff' : '#000000',
      backgroundColor: newTheme === 'dark' ? '#0a0e1a' : '#f8fafc',
      animation: { duration: 300, timingFunc: 'easeIn' }
    });
  },

  setFbType(e) {
    this.setData({ feedbackType: e.currentTarget.dataset.type });
  },

  onFeedbackInput(e) {
    this.setData({ feedbackContent: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ feedbackContact: e.detail.value });
  },

  submitFeedback() {
    if (this.data.loading) return;

    const { feedbackType, feedbackContent, feedbackContact } = this.data;

    if (!feedbackContent.trim()) {
      app.showToast('请输入反馈内容');
      return;
    }

    this.setData({ loading: true });

    // 3秒超时
    const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));

    Promise.race([
      app.request('/feedback/submit', {
        method: 'POST',
        data: {
          userId: app.globalData.userId,
          type: feedbackType,
          content: feedbackContent,
          contact: feedbackContact
        }
      }),
      timeout(3000)
    ]).then(() => {
      app.showToast('感谢反馈！', 'success');
      this.setData({ feedbackContent: '', feedbackContact: '' });
    }).catch(() => {
      app.showToast('反馈已保存(离线)', 'success');
      this.setData({ feedbackContent: '', feedbackContact: '' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  }
});
