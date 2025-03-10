/* eslint-disable no-undef */

const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt')
const path = require('path')
let PORT = 6060
app.use(cors({
    origin: ['https://electrocartatweb3.netlify.app','http://localhost:5173','https://n0wdj8fl-5173.inc1.devtunnels.ms']
}));
app.use(express.urlencoded({ extended: true }))
app.use(express.static('.'))
app.use(express.json())

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



app.listen(PORT, () => { console.log(`Server started at localhost ${PORT}.`) });