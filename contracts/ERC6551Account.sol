// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ERC6551Account
 * @dev Token-bound account implementation for ERC-6551
 */
contract ERC6551Account is IERC165, IERC1271 {
    using ECDSA for bytes32;

    uint256 public state;
    address public immutable implementation;
    uint256 public immutable chainId;
    address public immutable tokenContract;
    uint256 public immutable tokenId;

    error NotAuthorized();
    error InvalidSignature();
    error InvalidSigner();

    modifier onlyAuthorized() {
        if (msg.sender != owner()) revert NotAuthorized();
        _;
    }

    constructor() {
        implementation = address(this);
        chainId = block.chainid;
        tokenContract = address(0);
        tokenId = 0;
    }

    function owner() public view returns (address) {
        (uint256 chainId_, address tokenContract_, uint256 tokenId_) = _context();
        if (chainId_ != chainId) return address(0);
        
        if (IERC165(tokenContract_).supportsInterface(type(IERC721).interfaceId)) {
            return IERC721(tokenContract_).ownerOf(tokenId_);
        }
        
        if (IERC165(tokenContract_).supportsInterface(type(IERC1155).interfaceId)) {
            return IERC1155(tokenContract_).balanceOf(msg.sender, tokenId_) > 0 ? msg.sender : address(0);
        }
        
        return address(0);
    }

    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyAuthorized returns (bytes memory result) {
        ++state;
        
        bool success;
        (success, result) = to.call{value: value}(data);
        
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function token() external view returns (
        uint256 chainId_,
        address tokenContract_,
        uint256 tokenId_
    ) {
        return _context();
    }

    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4 magicValue) {
        bool isValid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);
        
        if (isValid) {
            return IERC1271.isValidSignature.selector;
        }
        
        return "";
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return (
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC1271).interfaceId
        );
    }

    function _context() internal view returns (
        uint256 chainId_,
        address tokenContract_,
        uint256 tokenId_
    ) {
        return (chainId, tokenContract, tokenId);
    }

    receive() external payable {}
}

/**
 * @title SignatureChecker
 * @dev Library for signature verification
 */
library SignatureChecker {
    function isValidSignatureNow(
        address signer,
        bytes32 hash,
        bytes memory signature
    ) internal view returns (bool) {
        if (signature.length == 65) {
            bytes32 r;
            bytes32 s;
            uint8 v;
            assembly {
                r := mload(add(signature, 32))
                s := mload(add(signature, 64))
                v := byte(0, mload(add(signature, 96)))
            }
            return signer == ecrecover(hash, v, r, s);
        } else if (signature.length == 64) {
            bytes32 r;
            bytes32 vs;
            assembly {
                r := mload(add(signature, 32))
                vs := mload(add(signature, 64))
            }
            return signer == ecrecover(hash, uint8(uint256(vs >> 255)) + 27, r, vs << 1 >> 1);
        } else {
            return false;
        }
    }
} 