/*
WEB322 Assignment 3
Stan's Gallery - 7 Wonders
Author: Stanislav Chirikov
Student ID 074631128
Used materials: https://www.iflscience.com/the-seven-wonders-of-the-ancient-world-and-where-to-find-them-68477
*/

//get all required modules
const express = require("express");
const exphbs = require('express-handlebars');
const path = require("path");
const fs = require("fs");
const session = require("client-sessions");
const randomStr = require("randomstring");
//include sale module
const buy = require("./buy.js");

//MongoDB connection
const MongoClient = require("mongodb").MongoClient;
const url = "mongodb+srv://Chirikov:OyRn7m8SN01apuRz@web322.wyskpws.mongodb.net/?retryWrites=true&w=majority&appName=WEB322";

//initialise variables
const HTTP_PORT = process.env.PORT || 3000;
let imageList = [];
let RandomString = randomStr.generate();
let connect, db, collection, DBdata, searchQuery, replacementValue, queryResult;

//connect to MongoDB
async function connectToMongoDB() {
    try {
        connect = await MongoClient.connect(url);
        db = connect.db("A3");
        collection = db.collection("Wonders");
        console.log(`connected to mongodatabase`);
    } catch (err) {
        throw err;
    }
}

//disconnect from MongoDB
async function disconnectFromMongoDB() {
    if (! typeof collection === 'undefined') {
        try {
            connect.close;
            console.log(`disconnected from mongodatabase`);
        } catch (err) {
            throw err;
        }
    }
}

//get images data from DB
function getImageDataFromDB() {
    try {
        DBdata = collection.find({}).toArray();
        return DBdata;
    } catch (err) {
        throw err;
    }
}

//get available images list from DB
function getImageList() {
    for (let i = 0; i < DBdata.length; i++) {
        if (DBdata[i].status == "A") {
            imageList.push(DBdata[i].file.substring(0, DBdata[i].file.length - 4));
        }
    }
}

//load data from DB
async function reloadDB() {
    try {
        DBdata = await getImageDataFromDB();
        getImageList();
    } catch (err) {
        throw err;
    }
}

//reset DB
async function resetDB() {
    try {
        searchQuery = {status: "S"};
        replacementValue = {$set: {status: "A"}};
        queryResult = await collection.findOne(searchQuery);
        while (queryResult != null) {
            await collection.updateOne(searchQuery, replacementValue);
            queryResult = await collection.findOne(searchQuery);
        }
    } catch (err) {
        throw err;
    }
}

function findDBindex(db, item) {
    for (let i = 0; i < db.length; i++) {
        if (db[i].file == item) {
            return i;
        }
    }
}

//get user data
let userData = {};
fs.readFile("./user.json", "utf-8", (err, data) => {
    if (err) throw err;
    userData = JSON.parse(data);
});

//set up express
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    defaultLayout: false,
    layoutsDir: path.join(__dirname)
}));
app.set("view engine", ".hbs");

//set up user sessions
app.use(session({
	cookieName: "ActiveSession",
	secret: RandomString,
	duration: 5 * 60 * 1000,
	activeDuration: 2 * 60 * 1000,
    httpOnly: true,
    secure: true,
    ephemeral: true
}));

//login page
app.get("/", (req,res) => {
    req.ActiveSession.reset();
    disconnectFromMongoDB();
    res.render('loginPage');
});

//login attempt
app.post("/", (req,res) => {
    //initialise variables
    let login = req.body.EnterUsername;
    let password = req.body.EnterPassword;
    let msg ="";
    //wrong login
    if (!userData.hasOwnProperty(login)) {
        msg = "Not a registered username";
        res.render('loginPage', {msg});
    //wrong password
    } else if (userData[login] != password) {
        msg = "Invalid password";
        res.render('loginPage', {msg});
    //successful login - set session and redirect to gallery
    } else {
        req.ActiveSession.user = login;
        //reset image list
        imageList = [];
        //reset DB and load data from it
        (async () => {
            await connectToMongoDB();
            await resetDB();
            await reloadDB();
            imageTitle = "The Map of Wonders";
            let imagePath = path.join("images", (imageTitle+".jpg"));
            res.render('gallery', {
                data: {imageList, imageTitle, imagePath, login}
            });
        }) ();
    }
});

//gallery page
app.post("/gallery", (req,res) => {
    //redirect to login page if session was reset
    if (typeof req.ActiveSession.user === 'undefined') {
        res.render('loginPage');
    //display requested image
    } else {
        let login = req.ActiveSession.user;
        let imageTitle = req.body.chooseImage;
        if (typeof imageTitle === 'undefined' || imageTitle == "") {
            imageTitle = "The Map of Wonders";
            let imagePath = path.join("images", (imageTitle+".jpg"));
            res.render('gallery', {
                data: {imageList, imageTitle, imagePath, login}
            });
        } else {        
            let imagePath = path.join("images", (imageTitle+".jpg"));
            (async () => {
                dbIndex = findDBindex(DBdata, (imageTitle+".jpg"));
                let imageDescription = DBdata[dbIndex].description;
                let imagePrice = DBdata[dbIndex].price;
                res.render('gallery', {
                    data: {imageList, imageTitle, imagePath, imageDescription, imagePrice, login}
                });
            }) ();
        }
    }
});

//sale page logic
app.use("/buy", buy);

//back from sale page
app.post("/gallery/back_from_sale", (req,res) => {
    //redirect to login page if session was reset
    if (typeof req.ActiveSession.user === 'undefined') {
        res.render('loginPage');
    //display requested page
    } else {
    //in case transaction was canceled go back to the same image
        let login = req.ActiveSession.user;
        let imageTitle = req.body.transaction.substring(0, req.body.transaction.length - 1);
        let transactionResult = req.body.transaction[req.body.transaction.length - 1];
        if (transactionResult == "-") {
            let imagePath = path.join("images", (imageTitle+".jpg"));
            dbIndex = findDBindex(DBdata, (imageTitle+".jpg"));
            let imageDescription = DBdata[dbIndex].description;
            let imagePrice = DBdata[dbIndex].price;
            res.render('gallery', {
                data: {imageList, imageTitle, imagePath, imageDescription, imagePrice, login}
            });
    //in case transaction was successful go back to the main gallery page
        } else {
    //update MongoDB
            dbFile = imageTitle+".jpg";
            (async () => {
                try {
                    searchQuery = {file: dbFile};
                    replacementValue = {$set: {status: "S"}};
                    await collection.updateOne(searchQuery, replacementValue);
                } catch (err) {
                    throw err;
                }
    //go back to gallery main page
            //reset image list
            imageList = [];
            //reload DB data
                await reloadDB();
                imageTitle = "The Map of Wonders";
                let imagePath = path.join("images", (imageTitle+".jpg"));
                res.render('gallery', {
                    data: {imageList, imageTitle, imagePath, login}
                });
            }) ();
        }
    }
});

//listen on port
const server = app.listen(HTTP_PORT, () => {
    console.log(`Listening on port ${HTTP_PORT}`);
});