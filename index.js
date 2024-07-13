import express from "express";
import bodyParser from "body-parser";
import pkg from 'pg';
import dotenv from 'dotenv';

const app = express();
const port = process.env.PORT || 3000;
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;
let users = [];

async function checkVisited() {
  try {
    const result = await pool.query(
      "SELECT state_code FROM visited_states JOIN users ON users.id = user_id WHERE user_id = $1;",
      [currentUserId]
    );
    return result.rows.map(state => state.state_code);
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getCurrentUser() {
  try {
    const result = await pool.query("SELECT * FROM users");
    users = result.rows;
    return users.find(user => user.id == currentUserId);
  } catch (err) {
    console.error(err);
    return null;
  }
}

app.get("/", async (req, res) => {
  try {
    const states = await checkVisited();
    const currentUser = await getCurrentUser();
    res.render("index.ejs", {
      states,
      total: states.length,
      users,
      color: currentUser ? currentUser.color : null,
      error: null,
    });
  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      states: [],
      total: 0,
      users,
      color: null,
      error: err.message,
    });
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["state"];
  const currentUser = await getCurrentUser();

  try {
    const stateResult = await pool.query(
      "SELECT state_code FROM states WHERE LOWER(state_name) = $1;",
      [input.toLowerCase()]
    );

    if (stateResult.rows.length === 0) {
      throw new Error("State name does not exist, try again.");
    }

    const stateCode = stateResult.rows[0].state_code;

    const visitedResult = await pool.query(
      "SELECT * FROM visited_states WHERE state_code = $1 AND user_id = $2;",
      [stateCode, currentUserId]
    );

    if (visitedResult.rows.length > 0) {
      throw new Error("State has already been added, try again.");
    }

    await pool.query(
      "INSERT INTO visited_states (state_code, user_id) VALUES ($1, $2)",
      [stateCode, currentUserId]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    const states = await checkVisited();
    res.render("index.ejs", {
      states,
      total: states.length,
      users,
      color: currentUser ? currentUser.color : null,
      error: err.message,
    });
  }
});

app.post("/user", async (req, res) => {
  try {
    if (req.body.add === "new") {
      res.render("new.ejs");
    } else {
      currentUserId = req.body.user;
      res.redirect("/");
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const { name, color } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    currentUserId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect("/new");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
