const express = require("express");
const basicAuth = require("express-basic-auth");
const path = require("path");
const config = require("./config");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(
  basicAuth({
    users: { [config.basicAuthUser]: config.basicAuthPassword },
    challenge: true,
    realm: "Portail de provisioning",
  })
);

app.use(require("./routes/form"));
app.use(require("./routes/provision"));
app.use(require("./routes/jobs"));

app.listen(config.port, () => {
  console.log(`Portail de provisioning en ecoute sur le port ${config.port}`);
});
