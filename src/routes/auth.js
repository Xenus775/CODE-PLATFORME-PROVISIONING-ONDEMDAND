const express = require("express");
const users = require("../services/users");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("login", { error: null });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const ok = username && password && (await users.verifyPassword(username, password));
  if (!ok) {
    return res.status(401).render("login", { error: "Identifiants invalides." });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).render("login", { error: "Erreur de session." });
    req.session.user = username;
    res.redirect("/");
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

module.exports = { router, requireAuth };
