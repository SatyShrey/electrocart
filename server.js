/* eslint-disable no-undef */

const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt')
const path = require('path')

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

let PORT = 6060
app.use(cors({
    origin: ['https://electrocartatweb3.netlify.app','http://localhost:5173','https://n0wdj8fl-5173.inc1.devtunnels.ms']
}));
app.use(express.urlencoded({ extended: true }))
app.use(express.static('.'))
app.use(express.json())

//mongodb client
const mongoClient = require('mongodb').MongoClient;
//const mongoUrl = 'mongodb://localhost:27017/'
const mongoUrl = 'mongodb+srv://sndsatya:QtAy7QbfwCnzUhvu@clustersnd.adfao0n.mongodb.net/'

//default page
app.get('/', (req, res) => {
    res.send(`Server running on port:${PORT}`);
    res.end()
})

//send product array
app.get('/products', (req, res) => {
    const file = path.join(__dirname, 'products.js')
    res.sendFile(file);
    res.end()
})

mongoClient.connect(mongoUrl).then(clientObject => {
    const db = clientObject.db('electrokart');
    //create user
    app.post('/createuser',(req, res) => {
       db.collection('users').findOne({email:req.body.email}).then(async(data)=>{
        if(data){res.send('User already exists. Plese use different email')}
        else{
            const hashPassword = await bcrypt.hash(req.body.password, 10)
            const user = { ...req.body, password: hashPassword }
            db.collection('users').insertOne(user)
            res.send('User created succesfully');
            res.end()
        }
       })
    });

    //get user data
    app.get('/user/:email/:password', (req, res) => {
        db.collection('users').findOne({ email: req.params.email })
            .then(async (user) => {
                if (user) {
                    const correctPassword = await bcrypt.compare(req.params.password, user.password)
                    if (correctPassword) { res.send({ message: 'Login success', user: user }); res.end() }
                    else { res.send({ message: 'Invalid credentials' }); res.end() }
                }
                else { res.send({ message: 'User not found' }); res.end() }
            })
    });

    //check user logged in or not
    app.post('/check', (req, res) => {
        db.collection('users').findOne(req.body).then(user => {
            res.send(user); res.end()
        })
    });

    //add to cart
    app.put('/addtocart/:id', (req, res) => {
        db.collection('users').updateOne({ email: req.params.id }, { $set: req.body }).then(() => {
            db.collection('users').findOne({ email: req.params.id }).then(user => {
                res.send(user); res.end()
            })
        })
    });

    //remove from cart
    app.put('/removefromcart/:uid/:pid', async (req, res) => {
        let cartItems=req.body
        let index=cartItems.findIndex(object=>object.id==req.params.pid)
        if(index !== -1){
            cartItems.splice(index,1)
        }
        db.collection('users').updateOne({ email: req.params.uid }, { $set: { cartItems: cartItems } }).then(() => {
            db.collection('users').findOne({ email: req.params.uid }).then((user) => {
                res.send(user); res.end();
            })
        })
    });
    //delete user
    app.delete('/deleteuser/:email',(req,res)=>{
        db.collection('users').deleteOne({email:req.params.email}).then(()=>{
            res.send();res.end()
        })
    });
    //remove from whitelist
    app.put('/whitelist/:uid',(req,res)=>{
        db.collection('users').updateOne({email:req.params.uid},{$set:{wishlist:req.body}}).then(()=>{
            db.collection('users').findOne({email:req.params.uid}).then((user)=>{
                res.send(user);res.end();
            })
        })
    })

})


//////////////////


const MERCHANT_KEY="96434309-7796-489d-8924-ab56988a6076"
const MERCHANT_ID="PGTESTPAYUAT86"

const MERCHANT_BASE_URL="https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay"
const MERCHANT_STATUS_URL="https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status"

const redirectUrl="https://electrocart-0x3v.onrender.com/status"


const successUrl="https://electrocartatweb3.netlify.app/payment-success"

const failureUrl="https://electrocartatweb3.netlify.app/payment-failure"



app.post('/create-order', async (req, res) => {

    const {name, mobileNumber, amount} = req.body;
    const orderId = uuidv4()

    //payment
    const paymentPayload = {
        merchantId : MERCHANT_ID,
        merchantUserId: name,
        mobileNumber: mobileNumber,
        amount : amount * 100,
        merchantTransactionId: orderId,
        redirectUrl: `${redirectUrl}/?id=${orderId}`,
        redirectMode: 'POST',
        paymentInstrument: {
            type: 'PAY_PAGE'
        }
    }

    const payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')
    const keyIndex = 1
    const string  = payload + '/pg/v1/pay' + MERCHANT_KEY
    const sha256 = crypto.createHash('sha256').update(string).digest('hex')
    const checksum = sha256 + '###' + keyIndex

    const option = {
        method: 'POST',
        url:MERCHANT_BASE_URL,
        headers: {
            accept : 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum
        },
        data :{
            request : payload
        }
    }
    try {
        
        const response = await axios.request(option);
        console.log(response.data.data.instrumentResponse.redirectInfo.url)
         res.status(200).json({msg : "OK", url: response.data.data.instrumentResponse.redirectInfo.url})
    } catch (error) {
        console.log("error in payment", error)
        res.status(500).json({error : 'Failed to initiate payment'})
    }

});


app.post('/status', async (req, res) => {
    const merchantTransactionId = req.query.id;

    const keyIndex = 1
    const string  = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + MERCHANT_KEY
    const sha256 = crypto.createHash('sha256').update(string).digest('hex')
    const checksum = sha256 + '###' + keyIndex

    const option = {
        method: 'GET',
        url:`${MERCHANT_STATUS_URL}/${MERCHANT_ID}/${merchantTransactionId}`,
        headers: {
            accept : 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': MERCHANT_ID
        },
    }

    axios.request(option).then((response) => {
        if (response.data.success === true){
            return res.redirect(successUrl)
        }else{
            return res.redirect(failureUrl)
        }
    })
});
/////////////////


app.listen(PORT, () => { console.log(`Server started at localhost ${PORT}.`) });