const User = require('../models/User')
const OTP = require('../models/OTP');
const sendEmail = require('../config/mailer');
const generateOTP = require('../utils/generateOTP');
const jwt = require('jsonwebtoken');
const validator = require('validator');

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
      otp
    });

    // Send OTP email
    const emailText = `Your verification OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;
    const emailSent = await sendEmail(email, 'Verify Your Email', emailText);

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
      otp
    });

    // Send OTP email
    const emailText = `Your new verification OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;
    const emailSent = await sendEmail(email, 'Verify Your Email', emailText);

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