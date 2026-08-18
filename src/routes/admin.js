const express = require("express");
const users = require("../services/users");
const { requireAdmin } = require("./auth");

const router = express.Router();

router.get("/admin", requireAdmin, (req, res) => {
  res.render("admin", { users: users.listUsers(), error: null, user: req.session.user });
});

router.post("/admin/users", requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    if (!username || !password) throw new Error("Identifiant et mot de passe requis.");
    await users.createUser(username.trim().toLowerCase(), password, role);
  } catch (err) {
    return res.status(400).render("admin", { users: users.listUsers(), error: err.message, user: req.session.user });
  }
  res.redirect("/admin");
});

router.post("/admin/users/:username/password", requireAdmin, async (req, res) => {
  try {
    if (!req.body.password) throw new Error("Nouveau mot de passe requis.");
    await users.setPassword(req.params.username, req.body.password);
  } catch (err) {
    return res.status(400).render("admin", { users: users.listUsers(), error: err.message, user: req.session.user });
  }
  res.redirect("/admin");
});

router.post("/admin/users/:username/role", requireAdmin, (req, res) => {
  try {
    users.setRole(req.params.username, req.body.role);
  } catch (err) {
    return res.status(400).render("admin", { users: users.listUsers(), error: err.message, user: req.session.user });
  }
  res.redirect("/admin");
});

router.post("/admin/users/:username/delete", requireAdmin, (req, res) => {
  try {
    if (req.params.username === req.session.user) {
      throw new Error("Impossible de supprimer votre propre compte.");
    }
    users.deleteUser(req.params.username);
  } catch (err) {
    return res.status(400).render("admin", { users: users.listUsers(), error: err.message, user: req.session.user });
  }
  res.redirect("/admin");
});

module.exports = router;
