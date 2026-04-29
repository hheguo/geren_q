const app = getApp();

Page({
  data: {
    roomCode: '',
    qrCodeImage: '', // Store Base64 image
    players: [],
    roundCount: 0, // Initialize to avoid NaN
    baseScore: 1,
    isEnded: false,
  },

  onLoad(options) {
    let code = options.code || options.uuid || '';
    
    // Handle WeChat QR Code scan (scene parameter)
    if (options.scene) {
      code = decodeURIComponent(options.scene);
    }

    this.setData({ roomCode: code });
    if (code) {
      this.loadRoomByCode(code);
      this.fetchRoomQRCode(code);
    }
  },

  onShareAppMessage() {
      return {
          title: '邀请你加入 TenpAI 麻将记分房间',
          path: `/pages/room/room?code=${this.data.roomCode}`,
          imageUrl: '/assets/invite_cover.png' // Optional: create a default cover or remove
      };
  },

  onShareTimeline() {
      return {
          title: 'TenpAI 麻将记分房间',
          query: `code=${this.data.roomCode}`
      };
  },

  async loadRoomByCode(roomCode) {
    try {
      const detail = await app.request(`/room/${roomCode}`, { method: 'GET' });
      const room = detail && detail.room ? detail.room : null;
      if (!room) return;

      app.globalData.currentRoom = room;
      app.globalData.records = Array.isArray(detail.records) ? detail.records : [];
      app.globalData.players = this.parsePlayers(room.players);
      this.refreshData();
    } catch (err) {
      console.error('Load room failed', err);
      app.showToast(err.message || '进入房间失败');
    }
  },

  parsePlayers(playersJson) {
    if (!playersJson) return [];
    try {
      const list = JSON.parse(playersJson);
      if (!Array.isArray(list)) return [];
      return list.map((p, index) => ({
        id: p.id,
        name: p.name || `玩家${index + 1}`,
        avatar: p.avatar || '',
        score: 0
      }));
    } catch (e) {
      return [];
    }
  },

  onShow() {
    this.refreshData();
  },

  fetchRoomQRCode(code) {
    app.request('/room/qrcode', {
      method: 'GET',
      data: { code }
    }).then(base64 => {
      this.setData({ qrCodeImage: base64 });
    }).catch(err => {
      console.error('QR Fetch Error', err);
      // Fallback or retry?
    });
  },

  refreshData() {
    const room = app.globalData.currentRoom;
    if (!room) return;
    
    // Check if we need to load QR code (if missing)
    if (room.roomCode && !this.data.qrCodeImage) {
        this.fetchRoomQRCode(room.roomCode);
    }


    let baseScore = 0;
    try {
      const rules = JSON.parse(room.rules || '{}');
      baseScore = rules.baseScore || 0;
    } catch (e) { /* ignore */ }

    let players = app.globalData.players || [];
    let records = Array.isArray(app.globalData.records) ? app.globalData.records : [];
    app.globalData.records = records; // ensure global data is also correct
    
    // 台版模式：自动添加“台版”虚拟玩家
    if (room.scoreMode === 1) {
      const hasTaiban = players.some(p => p.isTaiban);
      if (!hasTaiban) {
        players.push({
          id: 'taiban_' + Date.now(),
          name: '台版',
          score: 0,
          isTaiban: true
        });
        app.globalData.players = players;
      }
    }

    // Mark players as removable (Virtual only - Number ID) or protected (Real/Taiban - String ID)
    players.forEach(p => {
        // Simple check: Real users have 'wx...' or 'o...' string IDs. Virtual are Date.now() numbers.
        // Taiban has 'taiban_...' string ID, so strictly Date.now() IDs are removable.
        p.canRemove = typeof p.id === 'number'; 
    });

    // 记录列表倒序
    const reversedRecords = records.slice().reverse();

    const ranked = [...players].sort((a, b) => b.score - a.score);
    const rankedPlayers = ranked.map(p => ({
      ...p,
      initial: p.name.charAt(0),
      // 修复可能出现的 NaN
      score: p.score || 0,
      scoreText: (p.score || 0) > 0 ? '+' + p.score : String(p.score || 0)
    }));

    this.setData({
      players,
      rankedPlayers,
      roundCount: records.length,
      baseScore,
      isEnded: room.status === 1
    });
  },

  // ---------- 复制房间号 ----------
  copyCode() {
    wx.setClipboardData({
      data: this.data.roomCode,
      success() { /* wx 自动提示 */ }
    });
  },

  // ---------- 邀请弹窗 ----------
  showInvite() {
    this.setData({ showInviteModal: true });
  },

  closeInvite() {
    this.setData({ showInviteModal: false });
  },

  // ---------- 记分弹窗 - 胜/负选择 + 自动计算 ----------
  openScoreModal() {
    const scoreData = this.data.players.map(p => ({
      id: p.id,
      name: p.name,
      result: '',    // 'win' | 'lose' | ''
      score: 0,
      displayScore: '', // Input value
      isTaiban: p.isTaiban
    }));
    this.setData({ showScoreModal: true, scoreData });
  },

  closeScoreModal() {
    this.setData({ showScoreModal: false });
  },

  preventClose() {},

  // 用户点击胜/负
  setResult(e) {
    const { index, result } = e.currentTarget.dataset;
    const scoreData = this.data.scoreData;
    const current = scoreData[index];

    // 台版玩家不能选胜负
    if (current.isTaiban) return;

    if (current.result === result) return; // 没变

    current.result = result;
    
    // 切换胜负时，自动调整正负号
    let val = parseInt(current.score) || 0;
    if (result === 'win') {
      val = Math.abs(val); // 转正
    } else {
      val = -Math.abs(val); // 转负
    }
    
    current.score = val;
    // Display absolute value
    current.displayScore = val === 0 ? '' : String(Math.abs(val));

    this.setData({ scoreData });
    this.autoCalc();
  },

  onScoreInput(e) {
    const index = e.currentTarget.dataset.index;
    const rawVal = e.detail.value;
    const val = parseInt(rawVal); // user enters absolute number
    const scoreData = this.data.scoreData;
    const item = scoreData[index];

    item.displayScore = rawVal; 

    if (!isNaN(val)) {
      const absVal = Math.abs(val);
      // Determine sign based on result (or existing score if result unset)
      if (item.result === 'lose') {
         item.score = -absVal;
      } else if (item.result === 'win') {
         item.score = absVal;
      } else if (item.isTaiban) {
         if (item.score < 0) item.score = -absVal;
         else item.score = absVal;
      } else {
         // Default to positive if no result selected yet
         item.score = absVal; 
      }
    } else {
      item.score = 0;
    }

    this.setData({ scoreData });

    // 自动计算逻辑
    const room = app.globalData.currentRoom;
    if (room && room.scoreMode === 1) {
      // 台版模式：如果不是台版在输入，就自动计算台版
      if (!item.isTaiban) {
        this.autoCalcTaiban();
      }
    } else {
      // 普通模式
      if (item.result === 'win') {
        this.autoCalcLosers();
      }
    }
  },

  // Input Blur Validation: Clear invalid input
  onScoreBlur(e) {
      const index = e.currentTarget.dataset.index;
      const rawVal = e.detail.value;
      
      // If empty, leave it empty (will be caught by submit validation) 
      // OR reset to 0? User asked to "clear" if invalid.
      if (!rawVal) return;

      const val = parseInt(rawVal);
      if (isNaN(val)) {
          const key = `scoreData[${index}].displayScore`;
          const scoreKey = `scoreData[${index}].score`;
          this.setData({ 
              [key]: '',
              [scoreKey]: 0 
          });
          app.showToast('请输入有效数字');
      }
  },

  // 普通模式：自动计算负方分数
  autoCalcLosers() {
    const scoreData = this.data.scoreData;
    const baseScore = this.data.baseScore || 1;

    // 统计胜方总得分
    let winTotal = 0;
    scoreData.forEach(p => {
      if (p.result === 'win') {
        winTotal += (p.score || 0) * baseScore;
      }
    });

    // 计算负方人数
    const losers = scoreData.filter(p => p.result === 'lose');
    const loserCount = losers.length;

    // 将总失分均分给负方
    if (loserCount > 0 && winTotal > 0) {
      const eachLose = Math.round(winTotal / loserCount);
      scoreData.forEach(p => {
        if (p.result === 'lose') {
          p.score = -eachLose;
          // Display absolute
          p.displayScore = String(eachLose);
        }
      });
      this.setData({ scoreData });
    }
  },

  // 台版模式：自动计算台版分数
  autoCalcTaiban() {
     const scoreData = this.data.scoreData;
     let otherTotal = 0;
     let taibanParams = null;
     
     scoreData.forEach(p => {
       if (p.isTaiban) {
         taibanParams = p;
       } else {
         otherTotal += (p.score || 0);
       }
     });
     
     if (taibanParams) {
       const taibanScore = -otherTotal;
       taibanParams.score = taibanScore;
       // Display absolute
       taibanParams.displayScore = String(Math.abs(taibanScore));
       this.setData({ scoreData });
     }
  },
  
  autoCalc() {
    const room = app.globalData.currentRoom;
    if (!this.data.scoreData || this.data.scoreData.length === 0) return;
    
    if (room && room.scoreMode === 1) {
      this.autoCalcTaiban();
    } else {
      this.autoCalcLosers();
    }
  },

  submitScore() {
    const { scoreData } = this.data;
    const room = app.globalData.currentRoom;
    const isTaibanMode = room && room.scoreMode === 1;

    // 1. Mandatory Fields Check
    // Check if any visible player has empty input
    const emptyInput = scoreData.some(p => p.displayScore === '' || p.displayScore == null);
    if (emptyInput) {
        app.showToast('请填写所有玩家分数 (0也要填)');
        return;
    }

    // 2. Zero-Sum Check (All Modes)
    const total = scoreData.reduce((acc, curr) => acc + (curr.score || 0), 0);
    if (total !== 0) {
        // Calculate positive and negative sums for better error message
        const pos = scoreData.filter(i => i.score > 0).reduce((a, b) => a + b.score, 0);
        const neg = scoreData.filter(i => i.score < 0).reduce((a, b) => a + b.score, 0);
        app.showToast(`总分不平! 正:${pos} 负:${neg} (总:${total})`);
        return;
    }

    if (!isTaibanMode) {
      // 普通校验 extra logic
      const hasWin = scoreData.some(p => p.result === 'win');
      const hasLose = scoreData.some(p => p.result === 'lose');
      if (!hasWin || !hasLose) {
        app.showToast('请选择胜负');
        return;
      }
    }

    // 更新玩家分数
    const players = app.globalData.players;
    const scoreMap = {};
    scoreData.forEach(p => {
      const player = players.find(pp => pp.id === p.id);
      if (player) {
        player.score += p.score;
      }
      scoreMap[p.id] = p.score;
    });

    const roundNumber = (app.globalData.records || []).length + 1;
    const record = {
      roomId: app.globalData.currentRoom.id,
      roundNumber,
      scores: JSON.stringify(scoreMap),
      createTime: new Date().toISOString()
    };
    app.globalData.records.push(record);

    // 尝试同步后端
    app.request('/record/add', {
      method: 'POST',
      data: {
        roomId: app.globalData.currentRoom.id,
        roundNumber,
        scores: JSON.stringify(scoreMap),
        userId: app.globalData.userId,
        // 台版模式下 currentRoom.ownerId 对应的 score? 暂时取 scoreData[0] (假设是自己)
        userScore: scoreData.find(s=>s.id == app.globalData.userId)?.score || 0
      }
    }).catch(() => {});

    this.closeScoreModal();
    app.showToast(`第 ${roundNumber} 局已记录`);
    this.refreshData();
  },


  // ---------- 编辑玩家弹窗 ----------
  editPlayers() {
    this.setData({ showEditModal: true });
  },

  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  onEditName(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const players = this.data.players;
    if (players[index]) {
      players[index].name = value;
      this.setData({ players });
    }
  },

  removePlayer(e) {
    const index = e.currentTarget.dataset.index;
    const players = this.data.players;
    const player = players[index];

    // Double check restriction (though button should be hidden)
    if (typeof player.id !== 'number') {
        app.showToast('无法删除真实用户');
        return;
    }

    players.splice(index, 1);
    app.globalData.players = players;
    this.setData({ players: [...players] });
    this.syncPlayersToBackend();
  },

  addPlayer() {
    const players = this.data.players;
    players.push({
      id: Date.now(), // simple ID (Number type -> Removable)
      name: `玩家${players.length + 1}`,
      score: 0
    });
    app.globalData.players = players;
    this.setData({ players: [...players] });
    // Sync immediately
    this.syncPlayersToBackend();
  },

  saveEdit() {
    const players = this.data.players;
    players.forEach((p, i) => {
      if (!p.name.trim()) p.name = `玩家${i + 1}`;
    });
    app.globalData.players = players;
    this.closeEditModal();
    app.showToast('已更新');
    this.refreshData();
    this.syncPlayersToBackend();
  },

  syncPlayersToBackend() {
      const room = app.globalData.currentRoom;
      if (!room || !room.id) return;
      
      const playersToSave = app.globalData.players.map(p => ({
          id: String(p.id),
          name: p.name,
          avatar: p.avatar || ''
      }));

      app.request('/room/update', {
          method: 'POST',
          data: {
              id: room.id,
              players: JSON.stringify(playersToSave) // Store as JSON string
          }
      }).catch(err => console.error('Sync players failed', err));
  },

  // ---------- 结束房间 ----------
  endRoom() {
    const that = this;
    wx.showModal({
      title: '确认结束',
      content: '结束后无法继续记分',
      success(res) {
        if (res.confirm) {
          app.globalData.currentRoom.status = 1;

          // 保存到历史
          app.saveRoomToHistory(
            app.globalData.currentRoom,
            app.globalData.players,
            app.globalData.records
          );

          app.request('/room/end', {
            method: 'POST',
            data: { roomId: app.globalData.currentRoom.id }
          }).catch(() => {});

          app.showToast('房间已结束');
          that.refreshData();
        }
      }
    });
  },

  // ---------- 导航 ----------
  goHistory() {
    wx.navigateTo({ url: `/pages/history/history?code=${this.data.roomCode}` });
  },

  newRoom() {
    wx.navigateTo({ url: '/pages/create/create' });
  }
});
