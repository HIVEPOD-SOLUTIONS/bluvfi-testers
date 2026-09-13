"use strict";
// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition
Object.defineProperty(exports, "__esModule", { value: true });
const modules_1 = require("@nomicfoundation/hardhat-ignition/modules");
const ModredIPModule = (0, modules_1.buildModule)("ModredIPModule", (m) => {
    // Get the deployer account for platform fee collector
    const deployer = m.getAccount(0);
    // Deploy ERC-6551 Registry (no arguments needed)
    const registry = m.contract("ERC6551Registry");
    // Deploy Account Implementation for ERC-6551
    const accountImplementation = m.contract("ERC6551Account");
    // Add implementation to registry
    m.call(registry, "addImplementation", [accountImplementation]);
    // Deploy ModredIP contract with constructor arguments:
    // - registry address
    // - accountImplementation address
    // - chainId (97 for BSC Testnet / Chapel)
    // - platformFeeCollector address (using deployer)
    const ModredIPContract = m.contract("ModredIP", [
        registry,
        accountImplementation,
        97, // BSC Testnet (Chapel)
        deployer // Platform fee collector
    ]);
    return {
        ModredIPContract,
        registry,
        accountImplementation
    };
});
exports.default = ModredIPModule;
