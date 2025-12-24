const nodemailer = require('nodemailer');

class MailSender {
  constructor() {
    this._transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465, 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  sendEmail(targetEmail, subject, body) {
    const message = {
      from: 'OpenMusic Apps',
      to: targetEmail,
      subject,
      text: body,
      attachments: [
        {
          filename: 'playlist.json',
          content: body,
        },
      ],
    };

    return this._transporter.sendMail(message);
  }
}

module.exports = MailSender;