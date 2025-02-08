const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const Order = require("../../models/oderSchemma");
const Product = require("../../models/productSchema");
const Category = require("../../models/categotySchema");

const pageError = (req, res) => {
  res.render("admin-error");
};

const Loadlogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin login", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("admin login", {
          message: "Incorrect password, please try again.",
        });
      }
    } else {
      return res.render("admin login", {
        message: "No admin found with this email.",
      });
    }
  } catch (error) {
    console.log("Login error", error);
    return res.redirect("/pageError");
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard");
    } catch (error) {
      res.redirect("/pageError");
    }
  } else {
    res.redirect("/admin/login");
  }
};

const logout = (req, res) => {
  try {
    if (req.session.admin) {
      req.session.destroy((err) => {
        if (err) {
          console.log("Error destroying admin session:", err);
          return res.redirect("/pageError");
        }
        return res.redirect("/admin/login");
      });
    } else {
      console.log("No admin session found.");
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.log("Unexpected error during admin logout:", error);
    res.redirect("/pageError");
  }
};

module.exports = { Loadlogin, login, loadDashboard, pageError, logout };
