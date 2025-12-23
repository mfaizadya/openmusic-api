const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');

class AlbumsService {
  constructor(pool, cacheService) {
    this._pool = pool;
    this._cacheService = cacheService;
  }

  async addAlbum({ name, year }) {
    const id = `album-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3) RETURNING id',
      values: [id, name, year],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan');
    }

    return result.rows[0].id;
  }

  async getAlbumById(id) {
    const query = {
      text: 'SELECT * FROM albums WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Album tidak ditemukan');
    }

    const songsQuery = {
      text: 'SELECT id, title, performer FROM songs WHERE "albumId" = $1',
      values: [id],
    };

    const songsResult = await this._pool.query(songsQuery);

    return {
      ...result.rows[0],
      songs: songsResult.rows,
    };
  }

  async editAlbumById(id, { name, year }) {
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2 WHERE id = $3 RETURNING id',
      values: [name, year, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }
  }

  async addCoverAlbumById(id, coverUrl) {
    const query = {
      text: 'UPDATE albums SET cover_url = $1 WHERE id = $2 RETURNING id',
      values: [coverUrl, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui cover. Id tidak ditemukan');
    }
  }

  async addLikeAlbum(userId, albumId) {
    // Cek apakah album ada
    await this.getAlbumById(albumId); 
    
    // Cek apakah sudah like (bisa ditangani constraint DB, tapi pengecekan manual memberikan error message lebih jelas)
    const checkQuery = {
        text: 'SELECT id FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
        values: [userId, albumId],
    };
    const checkResult = await this._pool.query(checkQuery);
    if (checkResult.rowCount > 0) {
        throw new InvariantError('Gagal menyukai album. Anda sudah menyukai album ini.');
    }

    const id = `like-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO user_album_likes VALUES($1, $2, $3) RETURNING id',
      values: [id, userId, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Gagal menyukai album');
    }

    // Hapus Cache
    await this._cacheService.delete(`likes:${albumId}`);
  }

  async deleteLikeAlbum(userId, albumId) {
    const query = {
      text: 'DELETE FROM user_album_likes WHERE user_id = $1 AND album_id = $2 RETURNING id',
      values: [userId, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Gagal membatalkan like. Like tidak ditemukan');
    }

    // Hapus Cache
    await this._cacheService.delete(`likes:${albumId}`);
  }

  async getLikesCount(albumId) {
    try {
      // Coba ambil dari cache
      const result = await this._cacheService.get(`likes:${albumId}`);
      if (result) {
        return { count: JSON.parse(result), isCache: true };
      }
    } catch (error) {
        // Abaikan error cache, lanjut ke DB
    }

    // Jika tidak ada di cache, ambil dari DB
    // Pastikan album ada
    await this.getAlbumById(albumId);

    const query = {
      text: 'SELECT COUNT(*) FROM user_album_likes WHERE album_id = $1',
      values: [albumId],
    };

    const result = await this._pool.query(query);
    const count = parseInt(result.rows[0].count, 10);

    // Simpan ke cache
    await this._cacheService.set(`likes:${albumId}`, JSON.stringify(count));

    return { count, isCache: false };
  }
}

module.exports = AlbumsService;