import './App.css'

import { ethers } from 'ethers'
import React, { useCallback, useEffect, useState } from 'react'

// 导入 ABI
import MarketABI from './abis/Market.json'
import MyNFTABI from './abis/MyNFT.json';

// 合约地址
const MYNFT_ADDRESS = "0x68F2A34F1A99Df63e63cbd5A3718BDdeACfA079E";
const MARKET_ADDRESS = "0x55466C1D140Ae36fD3BB79482ca252C05C5E2bE5";

function App() {
  const [account, setAccount] = useState(null);
  const [nftContract, setNftContract] = useState(null);
  const [marketContract, setMarketContract] = useState(null);
  const [tokenId, setTokenId] = useState('');
  const [tokenCID, setTokenCID] = useState('');
  const [price, setPrice] = useState('');
  const [nftsForSale, setNftsForSale] = useState([]);
  const [userNFTs, setUserNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ethBalance, setEthBalance] = useState(null);
  const [showModal, setShowModal] = useState(true); // 控制弹窗默认显示

  // 连接到 MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        // 请求连接钱包
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const newAccount = await signer.getAddress();
        setAccount(newAccount);

        // 获取用户余额
        const balance = await provider.getBalance(newAccount);
        setEthBalance(ethers.utils.formatEther(balance));

        // 初始化合约实例
        const nftContractInstance = new ethers.Contract(
          MYNFT_ADDRESS,
          MyNFTABI.abi,
          signer
        );
        setNftContract(nftContractInstance);

        const marketContractInstance = new ethers.Contract(
          MARKET_ADDRESS,
          MarketABI.abi,
          signer
        );
        setMarketContract(marketContractInstance);

        // 关闭弹窗
        setShowModal(false);
      } catch (err) {
        console.error('Error connecting wallet:', err);
        alert('连接钱包失败，请重试。');
      }
    } else {
      alert('请安装 MetaMask 钱包插件！');
    }
  };

  // 铸造 NFT
  const mintNFT = async () => {
    if (!nftContract || !tokenCID) {
      alert('请确保已连接钱包并输入有效的令牌 CID。');
      return;
    }

    setLoading(true);
    try {
      const transaction = await nftContract.safeMint(account, tokenCID);
      await transaction.wait();
      alert('NFT 铸造成功！');
      // 刷新用户的 NFT
      fetchUserNFTs();
    } catch (err) {
      console.error(err);
      alert('铸造 NFT 时出错，请检查控制台。');
    } finally {
      setLoading(false);
    }
  };

  // 列出 NFT 出售
  const listNFTForSale = async () => {
    if (!marketContract || !tokenId || !price) {
      alert('请确保已输入令牌 ID 和价格。');
      return;
    }

    setLoading(true);
    try {
      const transaction = await marketContract.listNFTForSale(
        tokenId,
        ethers.utils.parseEther(price)
      );
      await transaction.wait();
      alert('NFT 已上架！');
      // 刷新市场上的 NFT
      fetchNftsForSale();
    } catch (err) {
      console.error(err);
      alert('上架 NFT 时出错，请检查控制台。');
    } finally {
      setLoading(false);
    }
  };

  // 下架 NFT
  const delistNFT = async (id) => {
    if (!marketContract) {
      alert('市场合约未初始化。');
      return;
    }

    setLoading(true);
    try {
      const transaction = await marketContract.delistNFT(id);
      await transaction.wait();
      alert('NFT 已下架！');
      // 刷新市场上的 NFT
      fetchNftsForSale();
    } catch (err) {
      console.error(err);
      alert('下架 NFT 时出错，请检查控制台。');
    } finally {
      setLoading(false);
    }
  };

  // 购买 NFT
  const buyNFT = async (tokenId, price) => {
    if (!account || !marketContract || !nftContract) {
      alert('请确保已连接钱包并选择要购买的 NFT。');
      return;
    }

    try {
      setLoading(true);
      const priceInWei = ethers.utils.parseEther(price);

      // 调用合约购买 NFT
      const tx = await marketContract.buyNFT(tokenId, { value: priceInWei });
      await tx.wait();

      alert('NFT 购买成功！');
      // 刷新市场上的 NFT
      fetchNftsForSale();
      // 刷新用户的 NFT
      fetchUserNFTs();
      // 更新余额
      updateBalance();
    } catch (err) {
      console.error(err);
      alert('购买 NFT 时出错，请检查控制台。');
    } finally {
      setLoading(false);
    }
  };

  // 获取正在出售的 NFT
  const fetchNftsForSale = useCallback(async () => {
    if (!marketContract || !nftContract) return;

    try {
      const totalSupply = await nftContract.totalSupply();
      const nfts = [];
      for (let i = 0; i < totalSupply.toNumber(); i++) {
        const tokenId = await nftContract.tokenByIndex(i);
        const priceBigNumber = await marketContract.getPrice(tokenId);
        const price = ethers.utils.formatEther(priceBigNumber);

        const isForSale = await marketContract.isForSale(tokenId);

        if (isForSale) {
          nfts.push({
            tokenId: tokenId.toString(),
            price: price,
          });
        }
      }

      setNftsForSale(nfts);
    } catch (err) {
      console.error(err);
      alert('获取正在出售的 NFT 时出错，请检查控制台。');
    }
  }, [marketContract, nftContract]);

  // 获取用户的所有 NFT
  const fetchUserNFTs = useCallback(async () => {
    if (!nftContract || !account) return;

    try {
      const totalSupply = await nftContract.totalSupply();
      const userNFTs = [];
      for (let i = 0; i < totalSupply.toNumber(); i++) {
        const tokenId = await nftContract.tokenByIndex(i);
        const owner = await nftContract.ownerOf(tokenId);
        const tokenURI = await nftContract.tokenURI(tokenId);
        const metadata = await fetchMetadata(tokenURI);

        if (owner.toLowerCase() === account.toLowerCase()) {
          userNFTs.push({ tokenId, metadata });
        }
      }
      setUserNFTs(userNFTs);
    } catch (err) {
      console.error(err);
      alert('获取用户 NFT 时出错，请检查控制台。');
    }
  }, [nftContract, account]);

  // 获取元数据
  const fetchMetadata = async (uri) => {
    try {
      const response = await fetch(uri);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching metadata:', err);
      return null;
    }
  };

  // 更新用户余额
  const updateBalance = useCallback(async () => {
    if (window.ethereum && account) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const balance = await provider.getBalance(account);
        setEthBalance(ethers.utils.formatEther(balance));
      } catch (err) {
        console.error('Error updating balance:', err);
      }
    }
  }, [account]);

  // 监听账户余额变化
  useEffect(() => {
    if (window.ethereum && account) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          updateBalance();
          fetchUserNFTs();
        } else {
          setAccount(null);
          setShowModal(true);
        }
      });

      window.ethereum.on('chainChanged', () => {
        updateBalance();
        fetchNftsForSale();
        fetchUserNFTs();
      });

      // 获取初始余额
      updateBalance();

      return () => {
        window.ethereum.removeListener('accountsChanged', updateBalance);
        window.ethereum.removeListener('chainChanged', updateBalance);
      };
    }
  }, [account, updateBalance, fetchUserNFTs]);

  // 页面加载时获取市场上的 NFT 和用户的 NFT（如果已连接）
  useEffect(() => {
    if (marketContract && nftContract) {
      fetchNftsForSale();
    }
  }, [marketContract, nftContract, fetchNftsForSale]);

  useEffect(() => {
    if (nftContract && account) {
      fetchUserNFTs();
    }
  }, [nftContract, account, fetchUserNFTs]);

  return (
    <div className="App">
      <h1>NFT交易平台</h1>

      {/* 连接钱包弹窗 */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>连接钱包</h2>
            <p>请点击下方按钮连接您的 MetaMask 钱包</p>
            <button className="modal-button" onClick={connectWallet}>
              连接 MetaMask
            </button>
          </div>
        </div>
      )}

      {/* 已连接钱包后的内容 */}
      {account && (
        <div className='container'>
          <div className='card'>
            <p>连接方式: {account}</p>
            <p>
              您的 ETH 账户余额:{' '}
              {ethBalance ? `${parseFloat(ethBalance).toFixed(4)} ETH` : '加载中...'}
            </p>
          </div>

          {/* 铸造 NFT */}
          <div className="card-container">
            <div className="card">
              <h2>铸造一个NFT</h2>
              <input
                type="text"
                placeholder="输入令牌 CID"
                value={tokenCID}
                onChange={(e) => setTokenCID(e.target.value)}
              />
              <button onClick={mintNFT} disabled={loading}>
                {loading ? '铸造中...' : '铸造 NFT'}
              </button>
            </div>

            <div className="card">
              <h2>出售NFT</h2>
              <input
                type="number"
                placeholder="输入令牌 ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
              />
              <input
                type="text"
                placeholder="输入价格 (ETH)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <button onClick={listNFTForSale} disabled={loading}>
                {loading ? '上架中...' : '上架 NFT'}
              </button>
            </div>
          </div>

          {/* 用户的 NFT */}
          <div className='card'>
            <h2>你的NFT</h2>
            {userNFTs.length === 0 ? (
              <p>你还没有自己的NFT</p>
            ) : (
              <div className="nft-gallery">
                {userNFTs.map(({ tokenId, metadata }) => {
                  // 检查 metadata 是否存在以及是否包含 image 属性
                  if (!metadata || !metadata.image) {
                    return (
                      <div key={tokenId.toString()} className="listBox">
                        <p>无法加载 Token ID: {tokenId.toString()} 的元数据</p>
                      </div>
                    );
                  }
                  return (
                    <div className="listBox" key={tokenId.toString()}>
                      <div className="listImg">
                        <img src={metadata.image} alt={metadata.name || '未知名称'} />
                      </div>
                      <div className="listTitle">
                        <h3>{metadata.name || '未知名称'}</h3>
                      </div>
                      <div className="listRemark">
                        <p>{metadata.description || '暂无描述'}</p>
                      </div>
                      <div className="listBtnBox">
                        <button
                          onClick={() => delistNFT(tokenId)}
                          disabled={loading}
                          className="btn1"
                        >
                          {loading ? '下架中...' : '下架销售'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 正在出售的 NFT */}
          <div className='card'>
            <h2>正在出售的NFT</h2>
            {nftsForSale.length === 0 ? (
              <p>无NFT出售中</p>
            ) : (
              <ul>
                {nftsForSale.map(({ tokenId, price }) => (
                  <li key={tokenId.toString()}>
                    令牌 ID: {tokenId.toString()}, 价格: {price.toString()} ETH
                    <button onClick={() => buyNFT(tokenId, price)} disabled={loading}>
                      {loading ? '购买中...' : '购买 NFT'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
