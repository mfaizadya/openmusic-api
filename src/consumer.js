require('dotenv').config();
const amqp = require('amqplib');
const { Pool } = require('pg');

const MailSender = require('./services/mail/MailSender');

const init = async () => {
  const pool = new Pool();
  const mailSender = new MailSender();

  const connection = await amqp.connect(process.env.RABBITMQ_SERVER);
  const channel = await connection.createChannel();

  await channel.assertQueue('export:playlists', {
    durable: true,
  });

  console.log('Consumer ready. Waiting for messages...');

  channel.consume('export:playlists', async (message) => {
    try {
      const { playlistId, targetEmail } = JSON.parse(message.content.toString());

      console.log(`Exporting playlist ${playlistId} to ${targetEmail}`);

      const playlist = await getPlaylistData(pool, playlistId);

      const result = await mailSender.sendEmail(
        targetEmail,
        'Ekspor Playlist',
        JSON.stringify(playlist, null, 2)
      );

      console.log('Export result:', result);
      channel.ack(message);
    } catch (error) {
      console.error('Export error:', error);
      channel.ack(message);
    }
  });
};

async function getPlaylistData(pool, playlistId) {
  const playlistQuery = {
    text: `SELECT playlists.id, playlists.name 
           FROM playlists 
           WHERE playlists.id = $1`,
    values: [playlistId],
  };
  const playlistResult = await pool.query(playlistQuery);

  if (!playlistResult.rows.length) {
    throw new Error('Playlist not found');
  }

  const songsQuery = {
    text: `SELECT songs.id, songs.title, songs.performer 
           FROM songs 
           JOIN playlist_songs ON songs.id = playlist_songs.song_id 
           WHERE playlist_songs.playlist_id = $1`,
    values: [playlistId],
  };
  const songsResult = await pool.query(songsQuery);

  return {
    playlist: {
      ...playlistResult.rows[0],
      songs: songsResult.rows,
    },
  };
}

init();