const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secretKey = "neomond";
const nodemailer = require("nodemailer");
require("dotenv").config();
const { validationResult } = require("express-validator");
const { User } = require("../models/user");

function generateOTP(length) {
  const digits = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    otp += digits.charAt(randomIndex);
  }
  return otp;
}

exports.signup = async (req, res, next) => {
  const { email, password } = req.body;
  console.log("geldi req");
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({
      email,
      password: hashedPassword,
    });
    await user.save();
    res.status(201).json({ message: "User created successfully" });
    next();
  } catch (error) {
    console.error("Error in signup route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }
    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "1h",
    });
    res.status(200).json({ token, user });
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    console.log(`Seeeeending OTP to ${email}`);

    const otp = generateOTP(4);
    console.log(otp);
    try {
      const user = await User.findOneAndUpdate(
        { email },
        { $set: { otp } },
        { new: true, useFindAndModify: false }
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SENDER,
          pass: process.env.USER_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SENDER,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP code is: ${otp}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          res.status(500).json({ error: "Error sending email" });
        } else {
          console.log("Email sentttttttt: " + info.response);
          res.json({ message: "OTP sent successfully" });
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.confirmAndResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email, otp });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found or OTP is invalid" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    user.otp = null;

    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// const saltRounds = 10;
// const salt = await bcrypt.genSalt(saltRounds);
// const hashedPassword = await bcrypt.hash(newPassword, salt);
