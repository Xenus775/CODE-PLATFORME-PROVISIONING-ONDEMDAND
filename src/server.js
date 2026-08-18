const express = require("express");
const session = require("express-session");
const path = require("path");
const config = require("./config");
const { router: authRouter, requireAuth } = require("./routes/auth");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 12 * 60 * 60 * 1000, // 12h
      sameSite: "lax",
    },
  })
);

app.use(authRouter);

// Tout ce qui suit necessite une session authentifiee.
app.use(requireAuth);

// Disponibles dans toutes les vues sans que chaque route ait a les passer
// explicitement (ex: le lien "Administration" de la sidebar, visible
// seulement pour role === "admin").
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.role = req.session.role;
  next();
});

app.use(require("./routes/form"));
app.use(require("./routes/provision"));
app.use(require("./routes/jobs"));
app.use(require("./routes/executions"));
app.use(require("./routes/admin"));

app.listen(config.port, () => {
  console.log(`Portail de provisioning en ecoute sur le port ${config.port}`);
});
