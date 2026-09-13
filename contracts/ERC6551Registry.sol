// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ERC6551Registry
 * @dev Registry for ERC-6551 token-bound accounts
 */
contract ERC6551Registry {
    event AccountCreated(
        address indexed account,
        address indexed implementation,
        uint256 chainId,
        address indexed tokenContract,
        uint256 tokenId,
        uint256 salt
    );

    mapping(bytes32 => address) public accounts;
    mapping(address => bool) public implementations;

    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address) {
        require(implementations[implementation], "Invalid implementation");
        
        bytes32 saltHash = keccak256(abi.encodePacked(salt));
        bytes32 accountHash = keccak256(
            abi.encodePacked(
                implementation,
                chainId,
                tokenContract,
                tokenId,
                saltHash
            )
        );

        address accountAddress = address(uint160(uint256(accountHash)));
        
        if (accounts[accountHash] == address(0)) {
            accounts[accountHash] = accountAddress;
            emit AccountCreated(
                accountAddress,
                implementation,
                chainId,
                tokenContract,
                tokenId,
                salt
            );
        }

        return accountAddress;
    }

    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        bytes32 saltHash = keccak256(abi.encodePacked(salt));
        bytes32 accountHash = keccak256(
            abi.encodePacked(
                implementation,
                chainId,
                tokenContract,
                tokenId,
                saltHash
            )
        );

        return accounts[accountHash];
    }

    function addImplementation(address implementation) external {
        implementations[implementation] = true;
    }

    function removeImplementation(address implementation) external {
        implementations[implementation] = false;
    }
} 