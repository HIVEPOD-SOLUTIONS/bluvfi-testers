"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const network_helpers_1 = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const chai_1 = require("chai");
const hardhat_1 = __importDefault(require("hardhat"));
const viem_1 = require("viem");
describe("ModredIP", function () {
    let modredIP;
    let registry;
    let accountImplementation;
    let owner;
    let creator;
    let licensee;
    let disputer;
    let feeCollector;
    const IP_HASH = "QmTestIPHash123456789";
    const METADATA = "QmTestMetadata123456789";
    const LICENSE_TERMS = "QmTestLicenseTerms123456789";
    // We define a fixture to reuse the same setup in every test.
    async function deployContractFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, creator, licensee, disputer, feeCollector] = await hardhat_1.default.viem.getWalletClients();
        // Set block base fee to zero because we want exact calculation checks without network fees
        await hardhat_1.default.network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
            "0x0",
        ]);
        // Deploy ERC-6551 Registry
        const registry = await hardhat_1.default.viem.deployContract("ERC6551Registry", []);
        // Deploy Account Implementation
        const accountImplementation = await hardhat_1.default.viem.deployContract("ERC6551Account", []);
        // Add implementation to registry
        await registry.write.addImplementation([accountImplementation.address]);
        // Deploy ModredIP
        const modredIP = await hardhat_1.default.viem.deployContract("ModredIP", [
            registry.address,
            accountImplementation.address,
            97n, // BSC Testnet (Chapel)
            feeCollector.account.address
        ]);
        const publicClient = await hardhat_1.default.viem.getPublicClient();
        return {
            modredIP,
            registry,
            accountImplementation,
            owner,
            creator,
            licensee,
            disputer,
            feeCollector,
            publicClient,
        };
    }
    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { modredIP, owner } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            const contractOwner = await modredIP.read.owner();
            (0, chai_1.expect)(contractOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
        });
        it("Should set the correct platform fee collector", async function () {
            const { modredIP, feeCollector } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            const collector = await modredIP.read.platformFeeCollector();
            (0, chai_1.expect)(collector.toLowerCase()).to.equal(feeCollector.account.address.toLowerCase());
        });
        it("Should set the correct platform fee percentage", async function () {
            const { modredIP } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            const feePercentage = await modredIP.read.platformFeePercentage();
            (0, chai_1.expect)(feePercentage).to.equal(250n); // 2.5%
        });
    });
    describe("IP Registration", function () {
        it("Should register a new IP asset", async function () {
            const { modredIP, creator } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            const ipAsset = await modredIP.read.getIPAsset([1n]);
            (0, chai_1.expect)(ipAsset[0].toLowerCase()).to.equal(creator.account.address.toLowerCase());
            (0, chai_1.expect)(ipAsset[1]).to.equal(IP_HASH);
            (0, chai_1.expect)(ipAsset[2]).to.equal(METADATA);
            (0, chai_1.expect)(ipAsset[3]).to.be.false;
            (0, chai_1.expect)(ipAsset[4]).to.be.false;
            (0, chai_1.expect)(ipAsset[7]).to.equal(10000n); // 100%
        });
        it("Should mint NFT to creator", async function () {
            const { modredIP, creator } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            const nftOwner = await modredIP.read.ownerOf([1n]);
            (0, chai_1.expect)(nftOwner.toLowerCase()).to.equal(creator.account.address.toLowerCase());
        });
        it("Should increment token ID", async function () {
            const { modredIP, creator } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.registerIP([IP_HASH + "2", METADATA + "2", true], {
                account: creator.account.address,
            });
            const nextTokenId = await modredIP.read.nextTokenId();
            (0, chai_1.expect)(nextTokenId).to.equal(3n);
        });
    });
    describe("License Minting", function () {
        it("Should mint a license", async function () {
            const { modredIP, creator } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.mintLicense([1n, 1000n, 86400n, true, LICENSE_TERMS], {
                account: creator.account.address,
            });
            const license = await modredIP.read.getLicense([1n]);
            (0, chai_1.expect)(license[0].toLowerCase()).to.equal(creator.account.address.toLowerCase());
            (0, chai_1.expect)(license[1]).to.equal(1n);
            (0, chai_1.expect)(license[2]).to.equal(1000n); // 10%
            (0, chai_1.expect)(license[3]).to.equal(86400n);
            (0, chai_1.expect)(license[5]).to.be.true;
            (0, chai_1.expect)(license[6]).to.be.true;
            (0, chai_1.expect)(license[7]).to.equal(LICENSE_TERMS);
        });
        it("Should transfer royalty tokens to licensee", async function () {
            const { modredIP, creator } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.mintLicense([1n, 1000n, 86400n, true, LICENSE_TERMS], {
                account: creator.account.address,
            });
            const ipAsset = await modredIP.read.getIPAsset([1n]);
            (0, chai_1.expect)(ipAsset[7]).to.equal(9000n); // 90% remaining
        });
        it("Should fail if royalty percentage too high", async function () {
            const { modredIP, creator } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await (0, chai_1.expect)(modredIP.write.mintLicense([1n, 15000n, 86400n, true, LICENSE_TERMS], {
                account: creator.account.address,
            })).to.be.rejectedWith("Invalid royalty percentage");
        });
    });
    describe("Revenue Payment", function () {
        it("Should accept revenue payment", async function () {
            const { modredIP, creator, licensee } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.mintLicense([1n, 1000n, 86400n, true, LICENSE_TERMS], {
                account: creator.account.address,
            });
            const paymentAmount = (0, viem_1.parseEther)("1.0");
            await modredIP.write.payRevenue([1n], {
                account: licensee.account.address,
                value: paymentAmount,
            });
            const royaltyInfo = await modredIP.read.getRoyaltyInfo([1n, creator.account.address]);
            (0, chai_1.expect)(royaltyInfo[0]).to.equal(paymentAmount);
        });
        it("Should distribute royalties correctly", async function () {
            const { modredIP, creator, licensee } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.mintLicense([1n, 1000n, 86400n, true, LICENSE_TERMS], {
                account: creator.account.address,
            });
            const paymentAmount = (0, viem_1.parseEther)("1.0");
            await modredIP.write.payRevenue([1n], {
                account: licensee.account.address,
                value: paymentAmount,
            });
            const royaltyInfo = await modredIP.read.getRoyaltyInfo([1n, creator.account.address]);
            (0, chai_1.expect)(royaltyInfo[0]).to.equal(paymentAmount);
            (0, chai_1.expect)(royaltyInfo[3] > 0n).to.be.true;
        });
    });
    describe("Dispute System", function () {
        it("Should allow raising disputes", async function () {
            const { modredIP, creator, disputer } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.raiseDispute([1n, "Potential plagiarism"], {
                account: disputer.account.address,
            });
            const dispute = await modredIP.read.disputes([1n]);
            (0, chai_1.expect)(dispute[0]).to.equal(1n);
            (0, chai_1.expect)(dispute[1]).to.equal(1n);
            (0, chai_1.expect)(dispute[2].toLowerCase()).to.equal(disputer.account.address.toLowerCase());
            (0, chai_1.expect)(dispute[3]).to.equal("Potential plagiarism");
            (0, chai_1.expect)(dispute[5]).to.be.false;
        });
        it("Should mark IP as disputed", async function () {
            const { modredIP, creator, disputer } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.registerIP([IP_HASH, METADATA, false], {
                account: creator.account.address,
            });
            await modredIP.write.raiseDispute([1n, "Potential plagiarism"], {
                account: disputer.account.address,
            });
            const ipAsset = await modredIP.read.getIPAsset([1n]);
            (0, chai_1.expect)(ipAsset[4]).to.be.true;
        });
    });
    describe("Admin Functions", function () {
        it("Should allow setting platform fee collector", async function () {
            const { modredIP, owner, licensee } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.setPlatformFeeCollector([licensee.account.address], {
                account: owner.account.address,
            });
            const collector = await modredIP.read.platformFeeCollector();
            (0, chai_1.expect)(collector.toLowerCase()).to.equal(licensee.account.address.toLowerCase());
        });
        it("Should allow setting platform fee percentage", async function () {
            const { modredIP, owner } = await (0, network_helpers_1.loadFixture)(deployContractFixture);
            await modredIP.write.setPlatformFeePercentage([500n], {
                account: owner.account.address,
            });
            const feePercentage = await modredIP.read.platformFeePercentage();
            (0, chai_1.expect)(feePercentage).to.equal(500n);
        });
    });
});
