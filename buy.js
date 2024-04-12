/*
WEB322 Assignment 3
Stan's Gallery - 7 Wonders
Author: Stanislav Chirikov
Student ID 074631128
Used materials: https://www.iflscience.com/the-seven-wonders-of-the-ancient-world-and-where-to-find-them-68477
*/

const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
    //redirect to login page if session was reset or image not chosen
    if (typeof req.ActiveSession.user === 'undefined' || req.body.buyImage === 'undefined') {
        res.render('loginPage');
    //render sales page
    } else {
        let imageData = req.body.buyImage;
        let imagePath = imageData.substring(0, imageData.indexOf("+"));
        let imageTitle = imagePath.substring(7, imagePath.length - 4);
        let imageDescription = imageData.substring(imagePath.length + 1, imageData.indexOf("="));
        let imagePrice = imageData.substring(imageData.indexOf("=") + 1);
        res.render('buy', {
            data: {imagePath, imageTitle, imageDescription, imagePrice}
        });
    }
});

module.exports = router;