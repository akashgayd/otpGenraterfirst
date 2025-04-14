const User = require('../models/User');
const OTP = require('../models/OTP');
const PasswordResetToken = require('../models/PasswordResetToken');
const sendEmail = require('../config/mailer');
const generateOTP = require('../utils/generateOTP');

const jwt = require('jsonwebtoken');
const validator = require('validator');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists'
      });
    }

    // Check OTP attempts
    const existingUser = await User.findOne({ email }).select('+otpAttempts +lastOtpAttempt');
    if (existingUser && existingUser.otpAttempts >= 4) {
      const now = new Date();
      const lastAttempt = new Date(existingUser.lastOtpAttempt);
      const diffTime = Math.abs(now - lastAttempt);
      const diffHours = diffTime / (1000 * 60 * 60);

      if (diffHours < 24) {
        return res.status(429).json({ 
          success: false,
          message: 'Maximum OTP attempts reached. Please try again tomorrow.'
        });
      } else {
        existingUser.otpAttempts = 0;
        await existingUser.save();
      }
    }

    // Create user (unverified)
    user = await User.create({
      name,
      email,
      password,
      isVerified: false
    });

    // Generate OTP
    const otp = generateOTP();

    // Save OTP to DB
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
    });

    // Send OTP email
    const emailText = `Your verification OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Your verification code is:</p>
        <h3 style="background: #f4f4f4; padding: 10px; display: inline-block;">${otp}</h3>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;
    
    const emailSent = await sendEmail(email, 'Verify Your Email', emailText, emailHtml);

    if (!emailSent) {
      return res.status(500).json({ 
        success: false,
        message: 'Email could not be sent'
      });
    }

    // Update OTP attempts
    if (existingUser) {
      existingUser.otpAttempts += 1;
      existingUser.lastOtpAttempt = new Date();
      await existingUser.save();
    }

    res.status(200).json({ 
      success: true,
      message: 'OTP sent to email'
    });

  } catch (err) {
    next(err);
  }
};

// @desc    Verify OTP
// @route   POST /api/v1/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Find the most recent OTP for the email
    const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ 
        success: false,
        message: 'No OTP found for this email'
      });
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP has expired'
      });
    }

    // Verify user
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true, otpAttempts: 0 },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(200).json({ 
      success: true,
      token
    });

  } catch (err) {
    next(err);
  }
};

// @desc    Resend OTP
// @route   POST /api/v1/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+otpAttempts +lastOtpAttempt');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }

    // Check OTP attempts
    if (user.otpAttempts >= 4) {
      const now = new Date();
      const lastAttempt = new Date(user.lastOtpAttempt);
      const diffTime = Math.abs(now - lastAttempt);
      const diffHours = diffTime / (1000 * 60 * 60);

      if (diffHours < 24) {
        return res.status(429).json({ 
          success: false,
          message: 'Maximum OTP attempts reached. Please try again tomorrow.'
        });
      } else {
        user.otpAttempts = 0;
        await user.save();
      }
    }

    // Generate new OTP
    const otp = generateOTP();

    // Save OTP to DB
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
    });

    // Send OTP email
    const emailText = `Your new verification OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Your new verification code is:</p>
        <h3 style="background: #f4f4f4; padding: 10px; display: inline-block;">${otp}</h3>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;
    
    const emailSent = await sendEmail(email, 'Verify Your Email', emailText, emailHtml);

    if (!emailSent) {
      return res.status(500).json({ 
        success: false,
        message: 'Email could not be sent'
      });
    }

    // Update OTP attempts
    user.otpAttempts += 1;
    user.lastOtpAttempt = new Date();
    await user.save();

    res.status(200).json({ 
      success: true,
      message: 'New OTP sent to email'
    });

  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ 
        success: false,
        message: 'Please verify your email first'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(200).json({ 
      success: true,
      token
    });

  } catch (err) {
    next(err);
  }
};

// @desc    Logout user
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // In a real app, you might want to implement token blacklisting here
    res.status(200).json({ 
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save reset token to DB
    await PasswordResetToken.create({
      userId: user._id,
      token: resetToken,
      expiresAt: resetTokenExpires
    });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;

    // Send email
    const emailText = `You are receiving this email because you (or someone else) has requested a password reset. Please make a PUT request to: \n\n ${resetUrl}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You are receiving this email because you (or someone else) has requested a password reset.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;
    
    const emailSent = await sendEmail(email, 'Password Reset Request', emailText, emailHtml);

    if (!emailSent) {
      return res.status(500).json({ 
        success: false,
        message: 'Email could not be sent'
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'Password reset email sent'
    });

  } catch (err) {
    next(err);
  }
};

// @desc    Reset password
// @route   PUT /api/v1/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Find the reset token
    const resetToken = await PasswordResetToken.findOne({ 
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Find user
    const user = await User.findById(resetToken.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();

    // Delete the reset token
    await PasswordResetToken.deleteOne({ _id: resetToken._id });

    // Send confirmation email
    const emailText = `Your password has been successfully reset. If you didn't make this change, please contact us immediately.`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Successful</h2>
        <p>Your password has been successfully reset.</p>
        <p>If you didn't make this change, please contact us immediately.</p>
      </div>
    `;
    
    await sendEmail(user.email, 'Password Reset Successful', emailText, emailHtml);

    res.status(200).json({ 
      success: true,
      message: 'Password reset successful'
    });

  } catch (err) {
    next(err);
  }
};