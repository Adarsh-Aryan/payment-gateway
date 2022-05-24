const express = require("express");
const https = require("https");
const qs = require("querystring");
const PaytmChecksum = require("./Paytm/checksum_test");
const config = require("./Paytm/config");
const cors = require("cors");
const connectedDatabase = require("./db");

const app = express();
app.use(cors());
const parseUrl = express.urlencoded({ extended: false });
const parseJson = express.json({ extended: false });

const PORT = process.env.PORT || 5000;

app.post("/paynow", [parseUrl, parseJson], async (req, res) => {
  // Route for making payment
  console.log(">>>>", req.body);
  var paymentDetails = {
    orderID: JSON.stringify(req.body._id),
    amount: req.body.cost,
    customerId: req.body.name || "Adarsh",
    customerEmail: req.body.email,
    customerPhone: req.body.phone || "9472351520",
    customerRest: req.body.rest_name || req.body.hotel_name,
  };

  if (
    !paymentDetails.amount ||
    !paymentDetails.customerPhone ||
    !paymentDetails.customerId ||
    !paymentDetails.customerEmail ||
    !paymentDetails.customerRest
  ) {
    res.status(422).send("Payment failed");
    return;
  }

  let client;

  try {
    client = await connectedDatabase();
  } catch (error) {
    res.status(500).send(error || "DataBase Connection Failed");
    client.close();
    return;
  }

  try {
    const db = client.db();

    await db.collection("allBookings").insertOne(req.body);
  } catch (error) {
    res.status(500).send(error || "Order Not Placed Successfully");
    client.close();
    return;
  }

  var params = {};
  params["MID"] = config.PaytmConfig.mid;
  params["WEBSITE"] = config.PaytmConfig.website;
  params["CHANNEL_ID"] = "WEB";
  params["INDUSTRY_TYPE_ID"] = "Retail";
  params["ORDER_ID"] = paymentDetails.orderID;
  params["CUST_ID"] = paymentDetails.customerId;
  params["TXN_AMOUNT"] = paymentDetails.amount;
  /* where is app is hosted (heroku url)*/
  params["CALLBACK_URL"] = "http://localhost:5000/callback";
  params["EMAIL"] = paymentDetails.customerEmail;
  params["MOBILE_NO"] = paymentDetails.customerPhone;

  var paytmChecksum = PaytmChecksum.generateSignature(
    params,
    config.PaytmConfig.key
  );
  paytmChecksum
    .then(function (checksum) {
      let paytmParams = {
        ...params,
        CHECKSUMHASH: checksum,
      };
      res.json(paytmParams);
    })
    .catch(function (error) {
      console.log(error);
    });
});
app.post("/callback", async (req, res) => {
  let client;

  try {
    client = await connectedDatabase();
  } catch (error) {
    res.status(500).send(error || "DataBase Connection Failed");
    client.close();
    return;
  }

  console.log("CALLBACK IS CALLED");
  // Route for verifiying payment

  var body = "";

  req.on("data", function (data) {
    body += data;
  });

  req.on("end", function () {
    var html = "";
    var post_data = qs.parse(body);

    // verify the checksum
    var checksumhash = post_data.CHECKSUMHASH;
    // delete post_data.CHECKSUMHASH;
    var isVerifySignature = PaytmChecksum.verifySignature(
      post_data,
      config.PaytmConfig.key,
      checksumhash
    );
    console.log("Checksum Result => ", isVerifySignature, "\n");

    if (isVerifySignature) {
      var params = { MID: config.PaytmConfig.mid, ORDERID: post_data.ORDERID };

      PaytmChecksum.generateSignature(params, config.PaytmConfig.key).then(
        function (err, checksum) {
          params.CHECKSUMHASH = checksum;
          post_data = JSON.stringify(params);

          console.log(post_data);

          var options = {
            hostname: "securegw-stage.paytm.in", // for staging
            // hostname: 'securegw.paytm.in', // for production
            port: 443,
            path: "/merchant-status/getTxnStatus",
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": post_data.length,
            },
          };

          // Set up the request
          var response = "";
          var post_req = https.request(options, function (post_res) {
            post_res.on("data", function (chunk) {
              response += chunk;
            });
            console.log(response);
            post_res.on("end", function () {
              console.log("S2S Response: ", response, "\n");
              var _results = JSON.parse(response);
              /* where it will come back after payment*/

              const db = client.db();
              db.collection("allBookings").findOneAndUpdate(
                { _id: Number(_results.ORDERID) },
                {
                  $set: {
                    status: _results.STATUS,
                    bankName: _results.BANKNAME,
                    txnDate: _results.TXNDATE,
                  },
                },
                { new: true },
                (err) => {
                  if (!err) {
                    res.redirect("http://localhost:3000/allbookings");
                  } else {
                    res.send(err);
                  }
                }
              );
            });
          });

          // post the data
          post_req.write(post_data);
          post_req.end();
        }
      );
    }
    // Send Server-to-Server request to verify Order Status
  });
});

app.listen(PORT, () => {
  console.log(`App is listening on Port ${PORT}`);
});
