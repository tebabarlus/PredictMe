import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function WalletConnectButton({ onWalletConnected, onWalletDisconnected, walletAddress, isLoading = false }) {
  const [connected, setConnected] = useState(!!walletAddress);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Update connected state when walletAddress prop changes
  useEffect(() => {
    setConnected(!!walletAddress);
  }, [walletAddress]);

  async function connectWallet() {
    if (connecting || isLoading) return;
    
    setConnecting(true);
    setError(null);

    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        if (accounts.length > 0) {
          setConnected(true);
          onWalletConnected(accounts[0]);
        }
      } catch (err) {
        console.error('Wallet connection error:', err);
        setError(err.message || 'User rejected wallet connection');
        alert(err.message || 'User rejected wallet connection');
      } finally {
        setConnecting(false);
      }
    } else {
      setError('MetaMask or another Ethereum wallet is required');
      alert('MetaMask or another Ethereum wallet is required.');
      setConnecting(false);
    }
  }

  function disconnectWallet() {
    if (isLoading) return;
    
    setConnected(false);
    setError(null);
    onWalletDisconnected();
  }

  // Determine button text based on state
  const getButtonText = () => {
    if (connecting || isLoading) {
      return 'Connecting...';
    }
    
    if (connected && walletAddress) {
      return `Disconnect (${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)})`;
    }
    
    return 'Connect Wallet';
  };

  // Determine button class based on state
  const getButtonClass = () => {
    if (connecting || isLoading) {
      return 'btn btn-secondary disabled';
    }
    
    if (connected && walletAddress) {
      return 'btn btn-secondary';
    }
    
    return 'btn btn-primary';
  };

  return (
    <div>
      <button 
        onClick={connected ? disconnectWallet : connectWallet}
        disabled={connecting || isLoading}
        className={getButtonClass()}
      >
        {getButtonText()}
      </button>
      {error && <div className="error-text mt-2 text-xs text-red-500">{error}</div>}
    </div>
  );
}
