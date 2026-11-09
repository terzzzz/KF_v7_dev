// js/matrix_storage.js

export const GDRIVE_CONFIG = {
  folderId: '15P5HeKqLxMYw3ykirJj2HMT726SZnkId',
  folderUrl: 'https://drive.google.com/drive/folders/15P5HeKqLxMYw3ykirJj2HMT726SZnkId?usp=sharing',
  // Paste your deployed Google Apps Script Web App URL here (or set at runtime via setBridgeUrl):
  bridgeUrl: localStorage.getItem('https://script.google.com/macros/s/AKfycbyTcELYnm4x-nLXhQE36V34cnl_CbWXK_KqM5PouBk7d_-MeDv7kpxwnr9mXeP5zmlb/exec') || '',
  // Optional Direct Google Drive OAuth Bearer Token:
  oauthToken: localStorage.getItem('https://script.google.com/macros/s/AKfycbyTcELYnm4x-nLXhQE36V34cnl_CbWXK_KqM5PouBk7d_-MeDv7kpxwnr9mXeP5zmlb/exec') || '',
  // Static GitHub fallback path when copied back to repo in one go:
  githubStaticDir: './data/matrices',
  numRiders: 7 // 7 vs 7 = 49 matchup files
};

export class MatrixStorageManager {
  constructor(config = {}) {
    this.config = { ...GDRIVE_CONFIG, ...config };
    this.dirHandle = null;                 // Optional local Google Drive desktop folder handle
    this.driveFileIdCache = new Map();     // fileName -> Google Drive fileId (for REST API v3)
    this.activeMatrices = new Map();       // "r0_vs_r1" -> in-memory weight payload
  }

  /**
   * Canonical key & filename for each of the 49 (7 vs 7) matchups.
   */
  getMatchupKey(riderA, riderB) {
    return `r${riderA}_vs_r${riderB}`;
  }

  getFileName(riderA, riderB) {
    return `matrix_r${riderA}_vs_r${riderB}.json`;
  }

  /**
   * Configure Google Apps Script Web App URL or OAuth token at runtime.
   */
  mountGoogleDrive({ bridgeUrl = null, oauthToken = null } = {}) {
    if (bridgeUrl) {
      this.config.bridgeUrl = bridgeUrl.trim();
      localStorage.setItem('RIDER_GDRIVE_BRIDGE_URL', this.config.bridgeUrl);
    }
    if (oauthToken) {
      this.config.oauthToken = oauthToken.trim();
      localStorage.setItem('RIDER_GDRIVE_OAUTH_TOKEN', this.config.oauthToken);
    }
    console.log(`[MatrixStorage] Mounted to Google Drive Folder: ${this.config.folderId}`);
  }

  /**
   * Optional: Mount local Google Drive Desktop folder via File System Access API.
   */
  async mountLocalSyncedDriveFolder() {
    if (!window.showDirectoryPicker) {
      throw new Error('Browser does not support showDirectoryPicker.');
    }
    this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    console.log(`[MatrixStorage] Mounted local directory: ${this.dirHandle.name}`);
    return this.dirHandle.name;
  }

  // ===========================================================================
  // SAVE / EDIT SINGLE MATCHUP MATRIX IN GOOGLE DRIVE (1 of 49)
  // ===========================================================================
  async saveMatchupMatrix(riderA, riderB, matrixData) {
    const key = this.getMatchupKey(riderA, riderB);
    const fileName = this.getFileName(riderA, riderB);
    this.activeMatrices.set(key, matrixData);

    // 1. Google Apps Script Bridge -> Direct edit inside Folder 15P5HeKqLxMYw3ykirJj2HMT726SZnkId
    if (this.config.bridgeUrl) {
      const res = await fetch(this.config.bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'save',
          folderId: this.config.folderId,
          fileName,
          matrixData
        })
      });
      const out = await res.json();
      if (!out.ok) throw new Error(`Google Drive Bridge error: ${out.error}`);
      return { target: 'gdrive_bridge', folderId: this.config.folderId, fileName };
    }

    // 2. Direct Google Drive REST API v3 -> Folder 15P5HeKqLxMYw3ykirJj2HMT726SZnkId
    if (this.config.oauthToken) {
      await this._saveViaDriveRestApi(fileName, matrixData);
      return { target: 'gdrive_rest_api', folderId: this.config.folderId, fileName };
    }

    // 3. Local Synced Google Drive Folder (if mounted via showDirectoryPicker)
    if (this.dirHandle) {
      const fh = await this.dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fh.createWritable();
      await writable.write(JSON.stringify(matrixData));
      await writable.close();
      return { target: 'local_folder', fileName };
    }

    // 4. Fallback: Persist in LocalStorage cache until Drive Bridge is connected
    try {
      localStorage.setItem(`MATRIX_${key}`, JSON.stringify(matrixData));
    } catch (_) {}
    return { target: 'memory_cache', fileName };
  }

  // ===========================================================================
  // FLUSH ALL 49 ACTIVE MATRICES TO GOOGLE DRIVE IN ONE BATCH
  // ===========================================================================
  async syncAll49ToGoogleDrive() {
    const files = [];
    for (const [key, matrixData] of this.activeMatrices.entries()) {
      files.push({
        fileName: `matrix_${key}.json`,
        matrixData
      });
    }
    if (files.length === 0) return { ok: true, count: 0 };

    if (this.config.bridgeUrl) {
      const res = await fetch(this.config.bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveBatch',
          folderId: this.config.folderId,
          files
        })
      });
      return await res.json();
    }

    // Otherwise save sequentially via configured backend
    for (const item of files) {
      const match = item.fileName.match(/^matrix_r(\d+)_vs_r(\d+)\.json$/);
      if (match) {
        await this.saveMatchupMatrix(Number(match[1]), Number(match[2]), item.matrixData);
      }
    }
    return { ok: true, count: files.length };
  }

  // ===========================================================================
  // LOAD SINGLE MATCHUP MATRIX (1 of 49)
  // Priority: Memory -> Google Drive (15P5HeKqLxMYw3ykirJj2HMT726SZnkId) -> GitHub Static
  // ===========================================================================
  async loadMatchupMatrix(riderA, riderB) {
    const key = this.getMatchupKey(riderA, riderB);
    const fileName = this.getFileName(riderA, riderB);

    // 1. In-memory active cache
    if (this.activeMatrices.has(key)) {
      return this.activeMatrices.get(key);
    }

    // 2. Local directory handle (if mounted)
    if (this.dirHandle) {
      try {
        const fh = await this.dirHandle.getFileHandle(fileName);
        const file = await fh.getFile();
        const data = JSON.parse(await file.text());
        this.activeMatrices.set(key, data);
        return data;
      } catch (_) {}
    }

    // 3. Google Drive Folder 15P5HeKqLxMYw3ykirJj2HMT726SZnkId via Bridge
    if (this.config.bridgeUrl) {
      try {
        const url = `${this.config.bridgeUrl}?action=load&fileName=${encodeURIComponent(fileName)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            this.activeMatrices.set(key, data);
            return data;
          }
        }
      } catch (_) {}
    }

    // 4. Google Drive Folder 15P5HeKqLxMYw3ykirJj2HMT726SZnkId via REST API v3
    if (this.config.oauthToken) {
      try {
        const data = await this._loadViaDriveRestApi(fileName);
        if (data) {
          this.activeMatrices.set(key, data);
          return data;
        }
      } catch (_) {}
    }

    // 5. GitHub Pages Static Folder (./data/matrices/matrix_rA_vs_rB.json)
    try {
      const staticRes = await fetch(`${this.config.githubStaticDir}/${fileName}`);
      if (staticRes.ok) {
        const data = await staticRes.json();
        this.activeMatrices.set(key, data);
        return data;
      }
    } catch (_) {}

    // 6. LocalStorage fallback
    const cached = localStorage.getItem(`MATRIX_${key}`);
    if (cached) {
      const data = JSON.parse(cached);
      this.activeMatrices.set(key, data);
      return data;
    }

    return null;
  }

  // ===========================================================================
  // DIRECT GOOGLE DRIVE REST API v3 HELPERS (Folder: 15P5HeKqLxMYw3ykirJj2HMT726SZnkId)
  // ===========================================================================
  async _resolveDriveFileId(fileName) {
    if (this.driveFileIdCache.has(fileName)) {
      return this.driveFileIdCache.get(fileName);
    }
    const q = encodeURIComponent(
      `'${this.config.folderId}' in parents and name = '${fileName}' and trashed = false`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.oauthToken}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      const id = data.files[0].id;
      this.driveFileIdCache.set(fileName, id);
      return id;
    }
    return null;
  }

  async _saveViaDriveRestApi(fileName, matrixData) {
    const jsonString = JSON.stringify(matrixData);
    const existingId = await this._resolveDriveFileId(fileName);

    if (existingId) {
      const url = `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.config.oauthToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonString
      });
    } else {
      const metadata = {
        name: fileName,
        parents: [this.config.folderId],
        mimeType: 'application/json'
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([jsonString], { type: 'application/json' }));

      const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.oauthToken}` },
        body: form
      });
      const created = await res.json();
      if (created.id) this.driveFileIdCache.set(fileName, created.id);
    }
  }

  async _loadViaDriveRestApi(fileName) {
    const fileId = await this._resolveDriveFileId(fileName);
    if (!fileId) return null;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.oauthToken}` }
    });
    return res.ok ? await res.json() : null;
  }
}

export const matrixStorage = new MatrixStorageManager();
