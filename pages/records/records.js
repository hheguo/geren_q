const app = getApp();

Page({
  data: {
    activeTab: 0, // 0: 进行中, 1: 已结束
    ongoingRooms: [],
    endedRooms: [],
    loading: false
  },

  onShow() {
    this.loadRooms();
  },

  loadRooms() {
    if (!app.globalData.userId) {
      this.setData({
        ongoingRooms: [],
        endedRooms: []
      });
      return;
    }

    this.setData({ loading: true });
    app.request('/room/list', {
      method: 'GET',
      data: { userId: app.globalData.userId }
    }).then(res => {
      const list = res || [];
      const ongoingRooms = list.filter(r => r.status === 0);
      const endedRooms = list.filter(r => r.status === 1);

      this.setData({
        ongoingRooms,
        endedRooms,
        loading: false
      });
    }).catch(err => {
      console.error(err);
      this.setData({ loading: false });
    });
  },

  switchTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    this.setData({ activeTab: tab });
  },

  goRoom(e) {
    const roomCode = e.currentTarget.dataset.code;
    const room = this.data.ongoingRooms.find(r => r.roomCode === roomCode);
    if(room) {
        app.globalData.currentRoom = room; // Ensure context is set
    }
    wx.navigateTo({
      url: `/pages/room/room?code=${roomCode}` // Use code parameter logic in room.js
    });
  },

  goHistory(e) {
    const roomCode = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/history/history?code=${roomCode}`
    });
  },
  
  formatTime(isoString) {
      if(!isoString) return '';
      const date = new Date(isoString);
      return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
  }
});
