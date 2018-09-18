const getRandomKey = require('uuid/v4')
const moment = require('moment')

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)

module.exports = {
  getApiKey: (req, res) => {
    // Generate a random API key
    const apiKey = getRandomKey().split('-')[0]

    // Add the new API key to our transactions in db.json
    db.set(`transactions[${apiKey}]`, []).write()

    // Send the API key back to the client
    return res.send({ apiKey })
  },

  // Middleware
  requireApiKey: (req, res, next) => {
    // Get the API key off of the request query
    const { key } = req.query

    if (typeof key === 'undefined' || key.length === 0) {
      // No key was provided, send an error status code
      return res.status(401).send('This request requires an API key')
    } else {
      // A key was provided, proceed to the endpoint
      next()
    }
  },

  // Middleware
  checkForValidKey: (req, res, next) => {
    // Get the API key from the request query
    const { key } = req.query
    // Check to see if the key is valid
    const transactions = db.has(`transactions[${key}]`).value()

    if (transactions === false) {
      // An invalid API key was used
      return res.status(400).send('Application not found')
    } else {
      // A valid API key was used, proceed to the endpoint
      next()
    }
  },

  getAllTransactions: (req, res) => {
    // Get the API key from the request query
    const { key } = req.query
    // Get all the associated transactions
    const transactions = db.get(`transactions[${key}]`).value()
    // Send the transactions back to the client
    res.send(transactions)
  },

  addTransaction: (req, res) => {
    // Get the API key off of the request query
    const { key } = req.query
    // Get the required properties off of the request body
    let { amount, cardNumber, exp, cvc, currency } = req.body
    // Create a regex formula for testing later on
    const commasExist = new RegExp(/,/)

    // Check to make sure the required properties were passed in
    if (
      amount === undefined ||
      cardNumber === undefined ||
      exp === undefined ||
      cvc === undefined ||
      currency === undefined
    ) {
      return res.status(400).send('required property missing from request body')
    }

    // All required properties were passed in
    // Format the expiration
    const expiration = moment(exp, 'MM/YY').endOf('M')

    if (!expiration.isValid()) {
      return res.status(400).send('Bad exp date format')
    } else if (expiration.isBefore(moment())) {
      return res.status(400).send('Card is expired')
    }

    // Format the cardNumber
    cardNumber = cardNumber
      .toString()
      .replace(/-/g, '')
      .split('')

    // Format the cvc number
    cvc = cvc.toString().split('')

    // Validate the card number
    if (cardNumber.length !== 16) {
      return res.status(400).send('Bad card number')
    }

    for (let i = 0; i < cardNumber.length; i++) {
      if (Number.isNaN(parseInt(cardNumber[i]))) {
        return res.status(400).send('Bad Card Number')
      }
    }

    // Validate the CVC number
    if (cvc.length > 4 || cvc.length < 3) {
      return res.status(400).send('Incorrect CVC')
    }

    for (let i = 0; i < cvc.length; i++) {
      if (Number.isNaN(parseInt(cvc[i]))) {
        return res.status(400).send('Incorrect CVC')
      }
    }

    // Validate the currency
    if (currency != 'usd') {
      return res.status(400).send('Only usd currency is supported at this time')
    }

    // Validate the amount
    if (Number.isNaN(amount) || commasExist.test(amount)) {
      return res.status(400).send('Invalid amount format')
    }

    // Format the amount, fee, net
    amount = parseFloat(amount).toFixed(2)
    let fee = (0.029 * amount + 0.3).toFixed(2)
    let net = (amount - fee).toFixed(2)

    // Generate a new transaction id
    const current_transactions = db.get(`transactions[${key}]`).value()
    let id =
      current_transactions.length === 0
        ? 0
        : current_transactions.reduce((acc, curr) => {
            if (curr.id > acc) acc = curr.id
            return acc
          }, 0)
    id++

    // Create a new transaction object
    let transaction = {
      id,
      status: 'cleared',
      currency,
      amount: amount.toString(),
      fee,
      net
    }

    // Add the new transaction
    db.get(`transactions[${key}]`)
      .push(transaction)
      .write()

    // Get the updated list of transactions
    const updated_transactions = db.get(`transactions[${key}]`).value()
    // Send the updated list of transactions back to the client
    res.send(updated_transactions)
  },

  refund: (req, res) => {
    // Get the API key from the request query
    const { key } = req.query
    // Get the required id property from the request parameters
    const { id } = req.params

    // Check to see that a valid id was used
    const match = db
      .get(`transactions[${key}]`)
      .find({ id: +id })
      .value()

    if (match === undefined) {
      // An invalid id was used
      return res.status(404).send('Transaction not found')
    }

    // A valid id was used
    // Update the transactions information
    db.get(`transactions[${key}]`)
      .find({ id: +id })
      .assign({
        status: 'refunded',
        fee: '0.00',
        net: '0.00'
      })
      .write()

    // Get the updated transaction
    const updated_transaction = db.get(`transactions[${key}]`).value()
    // Send the updated transaction back to the client
    res.send(updated_transaction)
  }
}
