import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from 'dotenv';

const app = express();
const port = 3000;

dotenv.config();

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [];

async function checkVisited() {
  const result = await db.query(
    "SELECT state_code FROM visited_states JOIN users ON users.id = user_id WHERE user_id = $1; ",
    [currentUserId]
  );
  let states = [];
  result.rows.forEach((state) => {
    states.push(state.state_code);
  });
  return states;
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

app.get("/", async (req, res) => {
  const states = await checkVisited();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    states: states,
    total: states.length,
    users: users,
    color: currentUser.color,
    error: null
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["state"];
  const currentUser = await getCurrentUser();

  try {
    const stateResult = await db.query(
      "SELECT state_code FROM states WHERE LOWER(state_name) = $1;",
      [input.toLowerCase()]
    );

    if (stateResult.rows.length === 0) {
      throw new Error("State name does not exist, try again.");
    }

    const stateCode = stateResult.rows[0].state_code;

    // Check if the state has already been visited by the current user
    const visitedResult = await db.query(
      "SELECT * FROM visited_states WHERE state_code = $1 AND user_id = $2;",
      [stateCode, currentUserId]
    );

    if (visitedResult.rows.length > 0) {
      throw new Error("State has already been added, try again.");
    }

    await db.query(
      "INSERT INTO visited_states (state_code, user_id) VALUES ($1, $2)",
      [stateCode, currentUserId]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
    const states = await checkVisited();
    res.render("index.ejs", {
      states: states,
      total: states.length,
      users: users,
      color: currentUser.color,
      error: err.message
    });
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
