const getRandomKey = require('uuid/v4');
const moment = require('moment')

const transactions = {};

module.exports = {
    getApiKey: (req, res) => {
        let apiKey = getRandomKey().split('-')[0];
        transactions[apiKey] = [];
        return res.send({apiKey})
    },

    requireApiKey: (req, res, next) => {
        if(!req.query.key) {
            return res.status(401).send('This request requires an API key');
        } else {
            next();
        }
    },

    attachTransactions: (req, res, next) => {
        if(!transactions[req.query.key]) {
            return res.status(400).send('Application not found')
        } else {
            req.transactions = transactions[req.query.key];
            next();
        }
    },
    
    getAllTransactions: (req, res) => {
        return res.send(req.transactions)
    },

    /*
        POST: /api/transactions
            send: 
                key: query
                body: 
                {
                    amount number as string, decimal, or float, no commas
                    cardNumber 16 digits, 
                    exp unexpired date in MM/YY format, 
                    cvc 3 or 4 digit, 
                    currency usd
                }
            response:
                {
                    transactionId,
                    status: 'cleared',
                    amount: total charged,
                    fee: processing fee,
                    net: net profit,
                }
    */

    addTransaction: (req, res) => {
        let {amount, cardNumber, exp, cvc, currency} = req.body;
        var commasExist = new RegExp(/,/);

        if(!amount || !cardNumber || !exp || !cvc) {
            return res.status(400).send('required property missing from request body');
        }
        let expiration = moment(exp, 'MM/YY').endOf('M');
        console.log({expiration}, expiration.isValid())
        
        if(!expiration.isValid()){
            return res.status(400).send('Bad exp date format');
        } else if(expiration.isBefore(moment())) {
            return res.status(400).send('Card is expired');
        }

        cardNumber = cardNumber.toString().replace(/-/g,'').split('');
        cvc = cvc.toString().split('');
        if(cardNumber.length !== 16) {
            return res.status(400).send('Bad card number');
        }
        for(let i=0; i<cardNumber.length; i++) {
            if(Number.isNaN(parseInt(cardNumber[i]))) {
                return res.status(400).send('Bad Card Number');
            }
        }
        if(cvc.length > 4 || cvc.length < 3) {
            return res.status(400).send('Incorrect CVC');
        }
        for(let i=0; i<cvc.length; i++) {
            if(Number.isNaN(parseInt(cvc[i]))) {
                return res.status(400).send('Incorrect CVC');
            }
        }
        if(currency != 'usd') {
            return res.status(400).send('Only usd currency is supported at this time');
        }
        if(Number.isNaN(amount) || commasExist.test(amount)) {
            return res.status(400).send('Invalid amount format');
        }
        amount = parseFloat(amount).toFixed(2);
        let fee = (.029 * amount + .3).toFixed(2);
        let net = (amount - fee).toFixed(2);
        let id = req.transactions.length === 0 ? 0 : req.transactions.reduce( (acc, curr) => {
            if(curr.id > acc) acc = curr.id;
            return acc
        }, 0)
        id++;

        let transaction = {
            id,
            status: 'cleared',
            currency,
            amount: amount.toString(),
            fee,
            net,
        }
        req.transactions.push(transaction);
        console.log(req.query.key, req.transactions)
        return res.send(transaction)
    },
    
    refund: (req, res) => {
        const {id} = req.params;
        let match = req.transactions.find( transaction =>{
            return transaction.id === +id 
        })
        if(!match) return res.status(404).send('Transaction not found')
        match.status = 'refunded';
        match.fee = '0.00';
        match.net = '0.00';
        return res.send(match)
    },

}             