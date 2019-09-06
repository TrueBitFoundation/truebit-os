pragma solidity ^0.5.0;


interface IToken {
    function balanceOf(address a) external view returns (uint);
    function allowance(address a, address b) external returns (uint);
    function transfer(address a, uint v) external;
    function transferFrom(address a, address b, uint v) external;
    function mint(address a, uint v) external;
}


