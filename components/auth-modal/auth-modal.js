const app = getApp();

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    nickname: '',
    avatarUrl: '',
    loading: false
  },

  methods: {
    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      this.setData({ avatarUrl });
    },

    onNicknameInput(e) {
      this.setData({ nickname: e.detail.value });
    },
    
    // 微信 2.29.0+ 可能需要 drag/blur 才能获取
    onNicknameBlur(e) {
      this.setData({ nickname: e.detail.value });
    },

    onCancel() {
      this.triggerEvent('cancel');
    },

    async doLogin() {
      if (this.data.loading) return;
      const { nickname, avatarUrl } = this.data;
      
      if (!nickname) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }
      if (!avatarUrl) {
         wx.showToast({ title: '请选择头像', icon: 'none' });
         return;
      }

      this.setData({ loading: true });

      try {
        const { code } = await wx.login();
        
        // 尝试同步后端
        const res = await app.request('/wx/login', {
            method: 'POST',
            data: { code, nickname, avatarUrl }
        });
          
        if (res && res.id) {
           app.globalData.userId = res.openid; // Use openid or id? Backend returns SysUser. Let's use OpenID as ID for simplicity in frontend or ID?
           // Actually backend returns SysUser which has ID and OpenID.
           // The app uses userId for logic. Let's use OpenID to be consistent with history? 
           // Or ID? GameRoom uses OwnerId (Long). So we should use ID.
           // BUT wait, app.js init checks 'tenpai_user'.
           
           app.globalData.userId = res.openid; // Keep using OpenID as string ID for now to avoid breaking other things?
           // Wait, the backend GameRoomController expects Long ownerId. 
           // "Long ownerId = Long.valueOf(params.get("ownerId").toString());"
           // So we MUST use the database ID (Long).
           
           app.globalData.userId = res.id; 
           app.globalData.nickname = res.nickname;
           app.globalData.avatarUrl = res.avatarUrl || '';
           app.globalData.isLoggedIn = true;
           app.saveUser();
        } else {
            throw new Error('Login failed');
        }

        this.setData({ loading: false });
        this.triggerEvent('success');
        
      } catch (e) {
        console.error(e);
        this.setData({ loading: false });
        wx.showToast({ title: '登录失败: ' + (e.message || e), icon: 'none' });
      }
    }
  }
});
