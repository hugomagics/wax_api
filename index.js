import express from 'express'
const app = express()
import { Api, JsonRpc} from 'eosjs';
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js"
import { PrivateKey } from "eosjs/dist/eosjs-key-conversions.js"
import { dateToTimePointSec, timePointSecToDate } from "eosjs/dist/eosjs-serialize.js";
import fetch from "node-fetch"
import _ from "lodash"
import bodyParser from "body-parser"
import util from "util"

const WAX_ENDPOINTS = _.shuffle([
	"https://api.waxsweden.org",
	"https://wax.cryptolions.io",
	"https://wax.eu.eosamsterdam.net",
	"https://api-wax.eosarabia.net",
	"https://wax.greymass.com",
	"https://wax.pink.gg",
]);

const Configs = {
	WAXEndpoints: [...WAX_ENDPOINTS],
};

async function shuffleEndpoints() {
	// shuffle endpoints to avoid spamming a single one
	Configs.WAXEndpoints = _.shuffle(WAX_ENDPOINTS);
	Configs.atomicEndpoints = _.shuffle(ATOMIC_ENDPOINTS);
}

var jsonParser = bodyParser.json()

app.post('/contract', jsonParser, async function (req,res) {
	const key = req.body['pvkey']
	const data = req.body['contract']

	try {
	
		const endpoint = _.sample(Configs.WAXEndpoints);
		const rpc = new JsonRpc(endpoint, { fetch });
	
		const accountAPI = new Api({
			rpc,
			signatureProvider: new JsSignatureProvider(key),
			textEncoder: new util.TextEncoder(),
			textDecoder: new util.TextDecoder(),
		});

		const info = await rpc.get_info();
		const subId = info.head_block_id.substr(16, 8);
		const prefix = parseInt(subId.substr(6, 2) + subId.substr(4, 2) + subId.substr(2, 2) + subId.substr(0, 2), 16);
		
		const transaction = {
			expiration: timePointSecToDate(dateToTimePointSec(info.head_block_time) + 3600),
			ref_block_num: 65535 & info.head_block_num,
			ref_block_prefix: prefix,
			actions: await accountAPI.serializeActions(data),
		};

		const abis = await accountAPI.getTransactionAbis(transaction);
		const serializedTransaction = await accountAPI.serializeTransaction(transaction);

		const accountSignature = await accountAPI.signatureProvider.sign({
			chainId: info.chain_id,
			abis,
			requiredKeys: key.map(pk => PrivateKey.fromString(pk).getPublicKey().toString()),
			serializedTransaction,
		});
		const pushArgs = { ...accountSignature };
		const result = await accountAPI.pushSignedTransaction(pushArgs);

		res.status(200).send({message: result.transaction_id})
	} catch (error) {
        res.status(404).send({message: error.message})
	}
})

app.use(
	express.urlencoded({
	  extended: true
	})
)

app.use(express.json())
app.listen(8001, () => {
    console.log("api transction on")
})