const SHARE_VERSION = '1.0';

export default {
  generateShareUrl(state) {
    const payload = this._encodeState(state);
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?s=${payload}`;
    
    if (url.length > 2000) {
      console.warn('[Share] URL too long, consider fewer selections');
    }
    
    return url;
  },

  _encodeState(state) {
    const payload = {
      v: SHARE_VERSION,
      ts: Math.floor(Date.now() / 1000),
      p: [],
      o: {
        c: state.onlyOpenSections ?? true,
        g: state.selectedCampus ?? ''
      }
    };

    if (state.selectedItems && state.selectedItems.length > 0) {
      state.selectedItems.forEach(item => {
        payload.p.push({
          i: item.subjectId || item.id,
          y: item.selectionType || 'p'
        });
      });
    }

    const jsonStr = JSON.stringify(payload);
    return btoa(encodeURIComponent(jsonStr));
  },

  decodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const encoded = urlParams.get('s');
    
    if (!encoded) {
      return null;
    }

    try {
      const jsonStr = decodeURIComponent(atob(encoded));
      const payload = JSON.parse(jsonStr);

      if (!payload.v || !payload.p) {
        console.warn('[ShareService] Invalid payload format');
        return null;
      }

      if (payload.v !== '1.0') {
        console.warn('[Share] Version incompatible');
        return null;
      }

      const selectedItems = [];
      if (payload.p && Array.isArray(payload.p)) {
        payload.p.forEach(item => {
          selectedItems.push({
            subjectId: item.i,
            selectionType: item.y || 'priority'
          });
        });
      }

      return {
        selectedItems,
        onlyOpenSections: payload.o?.c ?? true,
        selectedCampus: payload.o?.g ?? ''
      };
    } catch (error) {
      console.error('[ShareService] Error decoding URL:', error);
      return null;
    }
  },

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    } catch (error) {
      console.error('[ShareService] Copy to clipboard failed:', error);
      return false;
    }
  },

  async generateQrCode(url, size = 200) {
    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
        script.onload = () => {
          this._createQrCode(url, size, resolve, reject);
        };
        script.onerror = () => {
          reject(new Error('Failed to load QRCode library'));
        };
        document.head.appendChild(script);
      } else {
        this._createQrCode(url, size, resolve, reject);
      }
    });
  },

  _createQrCode(url, size, resolve, reject) {
    try {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 2
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(canvas);
        }
      });
    } catch (error) {
      reject(error);
    }
  },

  cleanUrl() {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
};
