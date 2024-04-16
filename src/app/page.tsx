"use client";
import { useRef, useState, useEffect } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import ABI from "./abi.json";
import { ethers } from "ethers";
// import nftABI from "./nftabi.json";

const nftABI = [
  "function safeTransferFrom (address from, address to, uint256 tokenId)",
];

// Web3Authの設定の参考
// https://web3auth.io/docs/quick-start?product=PNP&sdk=PNP_MODAL&framework=REACT&stepIndex=3

// Web3AuthのクライアントID
const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

// SepoliaiのChain Config
const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7",
  rpcTarget: "https://rpc.ankr.com/eth_sepolia",
  displayName: "Ethereum Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
};
//const chainConfig = {
// chainNamespace: "eip155",
// chainId: "0x89", // hex of 137, polygon mainnet
// rpcTarget: "https://rpc.ankr.com/polygon",
// Avoid using public rpcTarget in production.
// Use services like Infura, Quicknode etc
// displayName: "Polygon Mainnet",
// blockExplorerUrl: "https://polygonscan.com",
//ticker: "MATIC",
//  tickerName: "MATIC",
//};

// AlchemyのAPIキー
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// NFTのコントラクトアドレス
const nftContractAddress = process.env.NEXT_PUBLIC_ERC721_CONTRACT_ADDRESS!;

// フォワーダーのコントラクトアドレス
const forwarderContractAddress =
  process.env.NEXT_PUBLIC_FORWARDER_CONTRACT_ADDRESS!;

// Web3Authのお約束
const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig: chainConfig },
});

const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  privateKeyProvider: privateKeyProvider,
});

const options = {
  method: "GET",
  headers: { accept: "application/json" },
};
function App() {
  // NFTを送信する先のアドレス
  const destinationAddress = useRef<HTMLInputElement>(null);

  // 送信するNFTのトークンID
  const targetTokenId = useRef<HTMLSelectElement>(null);

  // 送信中にtrueになるフラグ
  const [submitting, setSubmitting] = useState(false);

  // web3auth state
  const [web3authProvider, setWeb3authProvider] = useState<IProvider | null>(
    null
  );
  const [loggedIn, setLoggedIn] = useState(false);

  // ログインしたユーザのウォレットアドレス
  const [walletAddress, setWalletAddress] = useState("");

  // ユーザが保有するNFTのリスト
  const [ownedNfts, setOwnedNfts] = useState([]);

  // トランザクションハッシュ
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        await web3auth.initModal();
        setWeb3authProvider(web3auth.provider);

        if (web3auth.connected) {
          setLoggedIn(true);
        }
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (loggedIn) {
      setUserInfo();
    }
  }, [loggedIn]);

  const setUserInfo = async () => {
    // ウォレットアドレスを取得
    const provider = new ethers.BrowserProvider(web3authProvider as IProvider);

    const signer = await provider.getSigner();

    const address = await signer.getAddress();

    setWalletAddress(address);

    // ユーザが保有するNFTを取得
    const nftRes = await fetch(
      "https://eth-sepolia.g.alchemy.com/nft/v3/" +
        alchemyApiKey +
        "/getNFTsForOwner?owner=" +
        address +
        "&contractAddresses[]=" +
        nftContractAddress +
        "&withMetadata=true&pageSize=100",
      options
    );

    const nfts = await nftRes.json();

    console.log(nfts);

    setOwnedNfts(nfts.ownedNfts);
  };

  const login = async () => {
    const web3authProvider = await web3auth.connect();
    setWeb3authProvider(web3authProvider);
    if (web3auth.connected) {
      setLoggedIn(true);
      setUserInfo();
    }
  };

  const logout = async () => {
    await web3auth.logout();
    setWeb3authProvider(null);
    setLoggedIn(false);
    uiConsole("logged out");
  };

  function uiConsole(...args: any[]): void {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
    console.log(...args);
  }

  async function signMetaTransaction(
    forwarderAddress: string,
    nftContractAddress: string,
    signer: any,
    toAddress: string,
    tokenId: string
  ) {
    const forwarderContract = new ethers.Contract(
      forwarderAddress,
      ABI,
      signer
    );

    const eip712domain = await forwarderContract.eip712Domain();
    const domain = {
      chainId: eip712domain.chainId,
      name: eip712domain.name,
      verifyingContract: eip712domain.verifyingContract,
      version: eip712domain.version,
    };
    const types = {
      ForwardRequest: [
        { type: "address", name: "from" },
        { type: "address", name: "to" },
        { type: "uint256", name: "value" },
        { type: "uint256", name: "gas" },
        { type: "uint256", name: "nonce" },
        { type: "uint48", name: "deadline" },
        { type: "bytes", name: "data" },
      ],
    };
    // ERC721 transfer
    const iface = new ethers.Interface(nftABI);
    const data = iface.encodeFunctionData("safeTransferFrom", [
      signer.address,
      toAddress,
      tokenId,
    ]);
    console.log(signer.address, toAddress, tokenId);
    const value = {
      from: signer.address,
      to: nftContractAddress,
      value: 0,
      gas: 5000000,
      nonce: await forwarderContract.nonces(signer.address),
      deadline: Math.floor(Date.now() / 1000) + 3600,
      data: data,
    };
    let sign = await signer.signTypedData(domain, types, value);
    let request = {
      from: value.from,
      to: value.to,
      value: value.value,
      gas: value.gas,
      deadline: value.deadline,
      data: value.data,
      signature: sign,
    };
    return request;
  }

  const sendTx = async (event: any) => {
    event.preventDefault();
    const address = destinationAddress.current?.value || null;
    const tokenId = targetTokenId.current?.value || null;

    setSubmitting(true);

    try {
      // 送り先アドレスが未入力ならエラー
      if (!address) throw new Error("Please enter a valid address");
      // トークンIDが未入力ならエラー
      if (!tokenId) throw new Error("Please select a token");
      // Forwarderコントラクトのインスタンスを作成
      //const provider = new ethers.BrowserProvider(
      // web3authProvider as IProvider
      //);

      const provider = new ethers.BrowserProvider(
        web3authProvider as IProvider
      );
      const signer = await provider.getSigner();
      const to = address;

      const request = await signMetaTransaction(
        forwarderContractAddress,
        nftContractAddress,
        signer,
        to,
        tokenId
      );
      console.log(request);

      const response = await fetch("/api/transfer", {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Content-Type": "application/json" },
      });
      console.log(response);
      const res = await response.json();
      console.log(res);
      const hash = res.hash;
      setTxHash(hash);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loggedInView = (
    <>
      <div className="flex-container">
        <div>
          <button onClick={logout} className="card">
            Log Out
          </button>
        </div>
      </div>
      <h2>Wallet Address</h2>
      <div>{walletAddress}</div>

      <h2>Own NFTs</h2>
      {ownedNfts.length === 0 && <div>No NFTs owned</div>}
      {ownedNfts.map((nft: any, index) => (
        <div key={index}>
          <img src={nft.image.originalUrl} alt="NFT" />
          <div>name: {nft.name}</div>
          <br />
          <div>description:</div>
          <div>{nft.description}</div>

          <br />
          <div>tokenId: {nft.tokenId}</div>
        </div>
      ))}
      <h2>Transfer NFT</h2>
      <form onSubmit={sendTx}>
        <input
          required={true}
          placeholder="Destination Wallet Address"
          ref={destinationAddress}
        ></input>
        <select ref={targetTokenId}>
          {ownedNfts.map((nft: any, index) => (
            <option key={index} value={nft.tokenId}>
              {nft.tokenId}
            </option>
          ))}
        </select>
        <button type="submit" disabled={submitting}>
          {submitting ? "processing..." : "Transfer"}
        </button>
      </form>
      <div>
        {txHash && (
          <div>
            <div>Transaction Hash: {txHash}</div>
            <div>
              <a
                href={chainConfig.blockExplorerUrl + "/tx/" + txHash}
                target="_blank"
              >
                view exploler
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const unloggedInView = (
    <button onClick={login} className="card">
      Login
    </button>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a
          target="_blank"
          href="https://web3auth.io/docs/sdk/pnp/web/modal"
          rel="noreferrer"
        >
          Web3Auth{" "}
        </a>
        & ReactJS (Webpack) Quick Start
      </h1>

      <div className="grid">{loggedIn ? loggedInView : unloggedInView}</div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
    </div>
  );
}

export default App;
