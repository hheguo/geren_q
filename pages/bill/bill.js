const app = getApp();

Page({
  data: {
    theme: 'dark',
    type: 'day', // day | month
    startDate: '',
    endDate: '',
    list: [],
    totalScore: 0,
    totalCount: 0
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme });
    
    // 默认最近30天
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    this.setData({
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    });
    
    if (app.globalData.isLoggedIn) {
      this.loadData();
    }
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      this.loadData();
    } else {
       app.showToast('请先登录');
       setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value }, () => this.loadData());
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value }, () => this.loadData());
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.type === type) return;
    this.setData({ type }, () => this.loadData());
  },

  async loadData() {
    if (!app.globalData.userId) return;

    wx.showLoading({ title: '加载中' });
    try {
      const res = await app.request('/bill/stats', {
        data: {
          userId: app.globalData.userId,
          type: this.data.type,
          startDate: this.data.startDate,
          endDate: this.data.endDate
        }
      });
      console.log('Bill stats:', res);

      this.setData({
        list: res.list || [],
        totalScore: res.totalScore || 0,
        totalCount: res.totalCount || 0
      });
    } catch (e) {
      console.error(e);
      // wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
