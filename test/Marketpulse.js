"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const network_helpers_1 = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const chai_1 = require("chai");
const hardhat_1 = __importDefault(require("hardhat"));
const viem_1 = require("viem");
//constants and local variables
const ODD_DECIMALS = 10;
let initAliceAmount = 0n;
let initBobAmount = 0n;
//Enum definition copy/pasta from Solidity code
var BET_RESULT;
(function (BET_RESULT) {
    BET_RESULT[BET_RESULT["WIN"] = 0] = "WIN";
    BET_RESULT[BET_RESULT["DRAW"] = 1] = "DRAW";
    BET_RESULT[BET_RESULT["PENDING"] = 2] = "PENDING";
})(BET_RESULT || (BET_RESULT = {}));
describe("Marketpulse", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContractFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, bob] = await hardhat_1.default.viem.getWalletClients();
        // Set block base fee to zero because we want exact calculation checks without network fees
        await hardhat_1.default.network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
            "0x0",
        ]);
        const marketpulseContract = await hardhat_1.default.viem.deployContract("Marketpulse", []);
        const publicClient = await hardhat_1.default.viem.getPublicClient();
        initAliceAmount = await publicClient.getBalance({
            address: owner.account.address,
        });
        initBobAmount = await publicClient.getBalance({
            address: bob.account.address,
        });
        return {
            marketpulseContract,
            owner,
            bob,
            publicClient,
        };
    }
    describe("init function", function () {
        it("should be initialized", async function () {
            const { marketpulseContract, owner } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            const ownerFromStorage = await marketpulseContract.read.admin();
            console.log("ownerFromStorage", ownerFromStorage);
            (0, chai_1.expect)(ownerFromStorage.toLowerCase()).to.equal(owner.account.address.toLowerCase()); //trick to remove capital letters
        });
        it("should return Pong", async function () {
            const { marketpulseContract, publicClient } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await marketpulseContract.write.ping({ gasPrice: 0n });
            const logs = await publicClient.getContractEvents({
                abi: marketpulseContract.abi,
                eventName: "Pong",
            });
            console.log(logs);
            (0, chai_1.expect)(logs.length).to.equal(1);
        });
    });
    // BET SCENARIO
    //full scenario should be contained inside the same 'it' , otherwise the full context is reset
    describe("scenario", () => {
        let betChiefs1Id = BigInt(0);
        let betLions2Id = "";
        let betKeys = [];
        it("should run the full scenario correctly", async () => {
            console.log("Initialization should return a list of empty bets");
            const { marketpulseContract, owner: alice, publicClient, bob, } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            (0, chai_1.expect)(await marketpulseContract.read.betKeys.length).to.equal(0);
            console.log("Chiefs bet for 1 ether should return a hash");
            const betChiefs1IdHash = await marketpulseContract.write.bet(["chiefs", (0, viem_1.parseEther)("1")], { value: (0, viem_1.parseEther)("1"), gasPrice: 0n });
            (0, chai_1.expect)(betChiefs1IdHash).not.null;
            // Wait for the transaction receipt
            let receipt = await publicClient.waitForTransactionReceipt({
                hash: betChiefs1IdHash,
            });
            (0, chai_1.expect)(receipt.status).equals("success");
            betKeys = [...(await marketpulseContract.read.getBetKeys())];
            console.log("betKeys", betKeys);
            betChiefs1Id = betKeys[0];
            console.log("Should find the Chiefs bet from hash");
            const betChiefs1 = await marketpulseContract.read.getBets([betChiefs1Id]);
            (0, chai_1.expect)(betChiefs1).not.null;
            (0, chai_1.expect)(betChiefs1.owner.toLowerCase()).equals(alice.account.address.toLowerCase());
            (0, chai_1.expect)(betChiefs1.option).equals("chiefs");
            (0, chai_1.expect)(betChiefs1.amount).equals((0, viem_1.parseEther)("1"));
            console.log("Should get a correct odd of 0.9 (including fees) for Chiefs if we bet 1");
            let odd = await marketpulseContract.read.calculateOdds([
                "chiefs",
                (0, viem_1.parseEther)("1"),
            ]);
            (0, chai_1.expect)(odd).equals(BigInt(Math.floor(0.9 * 10 ** ODD_DECIMALS))); //rounding
            console.log("Lions bet for 2 ethers should return a hash");
            // Set block base fee to zero
            await hardhat_1.default.network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
                "0x0",
            ]);
            const betLions2IdHash = await marketpulseContract.write.bet(["lions", (0, viem_1.parseEther)("2")], { value: (0, viem_1.parseEther)("2"), account: bob.account.address, gasPrice: 0n });
            (0, chai_1.expect)(betLions2IdHash).not.null;
            // Wait for the transaction receipt
            receipt = await publicClient.waitForTransactionReceipt({
                hash: betLions2IdHash,
            });
            (0, chai_1.expect)(receipt.status).equals("success");
            betKeys = [...(await marketpulseContract.read.getBetKeys())];
            console.log("betKeys", betKeys);
            const betLions2Id = betKeys[1];
            console.log("Should find the Lions bet from hash");
            const betLions2 = await marketpulseContract.read.getBets([betLions2Id]);
            (0, chai_1.expect)(betLions2).not.null;
            (0, chai_1.expect)(betLions2.owner.toLowerCase()).equals(bob.account.address.toLowerCase());
            (0, chai_1.expect)(betLions2.option).equals("lions");
            (0, chai_1.expect)(betLions2.amount).equals((0, viem_1.parseEther)("2"));
            console.log("Should get a correct odd of 1.9 for Chiefs (including fees) if we bet 1");
            odd = await marketpulseContract.read.calculateOdds([
                "chiefs",
                (0, viem_1.parseEther)("1"),
            ]);
            (0, chai_1.expect)(odd).equals(BigInt(Math.floor(1.9 * 10 ** ODD_DECIMALS)));
            console.log("Should get a correct odd of 1.23333 for lions (including fees) if we bet 1");
            odd = await marketpulseContract.read.calculateOdds([
                "lions",
                (0, viem_1.parseEther)("1"),
            ]);
            (0, chai_1.expect)(odd).equals(BigInt(Math.floor((1 + 1 / 3 - 0.1) * 10 ** ODD_DECIMALS)));
            console.log("Should return all correct balances after resolving Win on Chiefs");
            await marketpulseContract.write.resolveResult(["chiefs", BET_RESULT.WIN], { gasPrice: 0n });
            (0, chai_1.expect)(await publicClient.getBalance({
                address: marketpulseContract.address,
            })).equals((0, viem_1.parseEther)("0.1"));
            (0, chai_1.expect)(await publicClient.getBalance({ address: alice.account.address })).equals(initAliceAmount + (0, viem_1.parseEther)("1.9")); // -1+2.9
            (0, chai_1.expect)(await publicClient.getBalance({ address: bob.account.address })).equals(initBobAmount - (0, viem_1.parseEther)("2")); //-2
            console.log("Should have state finalized after resolution");
            const result = await marketpulseContract.read.status();
            (0, chai_1.expect)(result).not.null;
            (0, chai_1.expect)(result).equals(BET_RESULT.WIN);
            console.log("Should return an error if we try to resolve results again");
            try {
                await marketpulseContract.write.resolveResult(["chiefs", BET_RESULT.WIN], { gasPrice: 0n });
            }
            catch (e) {
                (0, chai_1.expect)(e.details).equals("VM Exception while processing transaction: reverted with reason string 'Result is already given and bets are resolved : \x00'");
            }
        });
    });
});
