const app = getApp();

Page({
  data: {
    records: [],
    roomCode: ''
  },

  onLoad(options) {
      if(options.code) {
          this.setData({ roomCode: options.code });
      }
  },

  onShow() {
    this.refreshRecords();
  },

  refreshRecords() {
    const code = this.data.roomCode;
    console.log('History refreshing for:', code);
    
    if (!code) return; // Should not happen

    app.request(`/room/${code}`, { // Call detail endpoint
        method: 'GET'
    }).then(res => {
        if (!res || !res.records) return;
        
        const records = res.records;
        const room = res.room || {};
        
        // Parse players from room if needed, or use globalData? 
        // Backend doesn't return players list explicitly in detail structure except in 'room.players' JSON
        let players = [];
        try {
            players = JSON.parse(room.players || '[]');
        } catch(e) {}
        
        // Format records
        const formatted = records.map((r, i) => {
          let scores = {};
          try {
            scores = typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores;
          } catch (e) { /* ignore */ }
    
          const scoreEntries = Object.entries(scores).map(([pid, delta]) => {
            // Find player name. ID might be string or number in JSON
            const player = players.find(p => String(p.id) === String(pid));
            const name = player ? player.name : `玩家${pid}`;
            const val = Number(delta);
            const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'zero';
            const text = val > 0 ? `+${val}` : String(val);
            return { name, text, cls };
          });
    
          return {
            roundNumber: r.roundNumber,
            scoreEntries
          };
        });
        
        // Sort descending for display
        formatted.reverse();
    
        this.setData({ records: formatted });

    }).catch(err => {
        console.error('Fetch history failed', err);
        app.showToast('加载历史失败');
    });
  }
});
