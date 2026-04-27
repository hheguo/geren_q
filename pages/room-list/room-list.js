const app = getApp();

Page({
  data: {
    roomHistory: [],
    theme: 'dark'
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme });
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const history = (app.globalData.roomHistory || []).map(r => {
      let timeText = '';
      if (r.createTime) {
        const d = new Date(r.createTime);
        timeText = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      return { ...r, timeText };
    });

    this.setData({
      roomHistory: history
    });
  }
});
