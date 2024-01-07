// email.js

const nodemailer = require('nodemailer');
const config = require('../config'); // Adjust the path based on your project structure

// Function to send a password reset email
async function sendPasswordResetEmail(email, resetToken) {
    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: config.email.service,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  
    // Construct the email message
    const mailOptions = {
      from: 'maungkaungthukhant@gmail.com',
      to: email,
      subject: 'Password Reset',
      text: `Click the following link to reset your password: http://localhost:${config.server.port}/reset-password/${resetToken}`,
    };
  
    try {
      // Send the email
      await transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
}
  

module.exports = sendPasswordResetEmail;
