require('dotenv').config();
const Web3 = require("web3");

const web3 = new Web3(process.env.BSC_MAIN_NET);
// L2L Token Contract ABI json
const l2lContractABI = require('./l2l_token_contract_abi.json');
// L2L Token Contract Address
const contractAddress = process.env.L2L_TOKEN_CONTRACT_ADDRESS;

/**
 * Returns the new user token wallet
 *
 * @returns {Account}
 */
const generateWallet = () => {

    return web3.eth.accounts.create();
}

/**
 * Returns transaction hash and errors if exists
 *
 * @param sender_private_key
 * @param toAddress
 * @param amount
 * @returns {Promise<{error: {}, transactionHash: null}>}
 */
const sendTokenToUser = async (sender_private_key, toAddress, amount, gas) => {

    let response = {
        transactionHash: null,
        error: {}
    };

    try {
        // get the sender address from its private key
        const senderAccount = await web3.eth.accounts.privateKeyToAccount(sender_private_key);
        const senderAddress = senderAccount.address;
        // sets the default address (sender address)
        web3.eth.defaultAccount = senderAddress;
        web3.eth.Contract.defaultAccount = senderAddress;

        /**
         * Defines the token contract
         *
         * @type {Contract}
         */
        const L2LContract = new web3.eth.Contract(l2lContractABI, contractAddress);

        /**
         * Checks the sender address balance
         */
        const senderBalance = BigInt(await L2LContract.methods.balanceOf(senderAddress).call());

        /**
         * Converts amount to wei
         *
         * @type {BN}
         */
        const amountInWei = BigInt(web3.utils.toWei(amount, "ether"));

        /**
         * Encode the token contract transfer function
         *
         * @type {string}
         */
        const encodedContractData = await L2LContract.methods.transfer(toAddress, amountInWei.toString()).encodeABI();

        /**
         * Estimate gas price for current transfer
         *
         * @type {BigNumber | number}
         */
        const currentGasEstimation = parseFloat(await L2LContract.methods.transfer(toAddress,amountInWei.toString()).estimateGas());

        /**
         * Approve the transaction
         */
        const transactionApproved = await L2LContract.methods.approve(toAddress, amountInWei.toString()).call();

        /**
         * Defines the raw transaction object
         *
         * @type {{data, gas: string, to: string}}
         */
        const rawTransactionObject = {
            to: contractAddress,
            data: encodedContractData,
            gas: gas,
        }

        /**
         * Sign raw transaction
         *
         * @returns {Promise<SignedTransaction>}
         */
        const signTransaction = async () => {
            return await web3.eth.accounts.signTransaction(rawTransactionObject, sender_private_key);
        }

        /**
         * Sends signedTransaction
         *
         * @param signedTransaction
         * @returns {PromiEvent<TransactionReceipt>}
         */
        const sendTransaction = async (signedTransaction) => {
            return web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
        }

        if(currentGasEstimation > gas) {
            response.error.gas = `Gas too low.You have to set minim gas to: ${currentGasEstimation}`;
        } else if(senderBalance < amountInWei) {
            console.log("Your token balance is too low : ", senderBalance, amountInWei, senderBalance < amountInWei);
            response.error.balance = "Your token balance is too low."
        } else if (!transactionApproved) {
            response.error.send = "Transaction is not approved";
        } else {
            /**
             * Handles signing and sending transaction
             */
            await signTransaction()
                .then(async (signedTransaction) => {
                    await sendTransaction(signedTransaction)
                        .then((transactionReceipt) => {
                            const {transactionHash} = transactionReceipt;
                            response.transactionHash = transactionHash;
                        })
                        .catch((sendError) => {
                            response.error.send = sendError.message;
                        })
                })
                .catch(signError => {
                    response.error.sign = signError.message;
                });
        }
    } catch (catchError) {
        response.error.catch = catchError.message;
    } finally {
        if (Object.keys(response.error).length === 0) {
            response.error = null;
        }
    }

    return response;
}

/**
 * Get user balance.
 * @param senderAddress
 * @returns {Promise<{error: {}, balance: null}>}
 */
const getUserBalance = async (senderAddress) => {
    let response = {
        balance2lc: null,
        balanceBnb: null,
        error: null
    };

    try {
        /**
         * Defines the token contract
         *
         * @type {Contract}
         */
        const L2LContract = new web3.eth.Contract(l2lContractABI, contractAddress);

        /**
         * Get sender address balance
         */
        const balance2lcInWei = await L2LContract.methods.balanceOf(senderAddress).call();

        /**
         * Get sender address balance
         */
        const balanceBnbInWei = await web3.eth.getBalance(senderAddress);

        /**
         * Converts from wei
         *
         * @type {BN}
         */
        response.balance2lc = web3.utils.fromWei(balance2lcInWei, "ether");
        response.balanceBnb = web3.utils.fromWei(balanceBnbInWei, "ether");
    } catch (catchError) {
        response.error = catchError.message;
    }

    return response;
}

module.exports = {
    generateWallet,
    sendTokenToUser,
    getUserBalance,
};
