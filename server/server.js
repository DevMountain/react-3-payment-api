const express = require("express");
const ctrl = require("../controllers/controller");
const path = require("path");

const app = express();
app.use(express.json());

/* 
    - Random increment to transaction id to simulate other users using the same API
    - Get transaction total?
*/

app.use(express.static(path.join(__dirname, "../swagger-ui/dist")));
app.use("/payment", express.static(path.join(__dirname, "../swagger-ui/dist")));

app.get("/payment/key", ctrl.getApiKey);

app.use(ctrl.requireApiKey, ctrl.attachTransactions);

app
  .route("/payment/transactions")
  .get(ctrl.getAllTransactions)
  .post(ctrl.addTransaction);

app.route("/payment/refund/:id").put(ctrl.refund);

const port = 5500;
app.listen(port, () =>
  console.log(`View the API docs at http://localhost:${port}`)
);
