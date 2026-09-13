import React, { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import { useNotificationHelpers } from '../contexts/NotificationContext';
import './IPPortfolio.css';

interface IPAsset {
  owner: string;
  ipHash: string;
  metadata: string;
  isEncrypted: boolean;
  isDisputed: boolean;
  registrationDate: bigint;
  totalRevenue: bigint;
  royaltyTokens: bigint;
}

interface License {
  licensee: string;
  tokenId: bigint;
  royaltyPercentage: bigint;
  duration: bigint;
  startDate: bigint;
  isActive: boolean;
  commercialUse: boolean;
  terms: string;
}

interface Portfolio {
  id: string;
  name: string;
  description: string;
  assets: number[];
  totalValue: bigint;
  createdAt: Date;
  isPublic: boolean;
  bundledLicenseTerms?: string;
}

interface IPPortfolioProps {
  assets: Map<number, IPAsset>;
  licenses: Map<number, License>;
  metadata: Map<number, any>;
  userAddress?: string;
  onTransferIP?: (tokenId: number, recipient: string) => Promise<void>;
}

export const IPPortfolio: React.FC<IPPortfolioProps> = ({
  assets,
  licenses,
  metadata,
  userAddress,
  onTransferIP
}) => {
  const { notifySuccess, notifyError } = useNotificationHelpers();
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'portfolios' | 'analytics'>('overview');
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set());
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({
    name: '',
    description: '',
    isPublic: true,
    bundledLicenseTerms: ''
  });
  const [transferModal, setTransferModal] = useState<{ open: boolean; tokenId: number | null; recipient: string }>({
    open: false,
    tokenId: null,
    recipient: ''
  });
  const [transferLoading, setTransferLoading] = useState(false);

  // Filter user's assets
  const userAssets = Array.from(assets.entries()).filter(([_, asset]) => 
    asset.owner.toLowerCase() === userAddress?.toLowerCase()
  );

  const userLicenses = Array.from(licenses.entries()).filter(([_, license]) => 
    license.licensee.toLowerCase() === userAddress?.toLowerCase()
  );

  // Calculate portfolio statistics
  const totalAssets = userAssets.length;
  const totalRevenue = userAssets.reduce((sum, [_, asset]) => sum + asset.totalRevenue, 0n);
  const totalLicenses = userLicenses.length;
  const activeLicenses = userLicenses.filter(([_, license]) => license.isActive).length;

  // Asset preview component with metadata fetching
  const AssetPreview: React.FC<{ assetId: number; asset: IPAsset; metadata: any }> = ({ 
    assetId, 
    asset, 
    metadata 
  }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchImageFromMetadata = async () => {
        try {
          setLoading(true);
          
          // If metadata has image field, use it
          if (metadata?.image) {
            let imageSource = metadata.image;
            
            // Convert IPFS URLs to gateway URLs
            if (imageSource.startsWith('ipfs://')) {
              imageSource = `https://gateway.pinata.cloud/ipfs/${imageSource.replace('ipfs://', '')}`;
            }
            
            setImageUrl(imageSource);
          } else {
            // Fallback to asset's ipHash
            const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${asset.ipHash.replace('ipfs://', '')}`;
            setImageUrl(gatewayUrl);
          }
        } catch (error) {
          console.error('Error fetching image from metadata:', error);
          setImageUrl(null);
        } finally {
          setLoading(false);
        }
      };

      fetchImageFromMetadata();
    }, [metadata, asset.ipHash]);

    return (
      <div className="asset-preview">
        {loading ? (
          <div className="preview-skeleton">
            <div className="skeleton skeleton-image"></div>
          </div>
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={metadata?.name || `IP Asset ${assetId}`}
            className="preview-image"
            onError={() => setImageUrl(null)}
          />
        ) : (
          <div className="preview-fallback">
            <span className="preview-icon">📄</span>
            <span className="preview-text">{metadata?.name || 'IP Asset'}</span>
          </div>
        )}
      </div>
    );
  };

  // Create new portfolio
  const createPortfolio = () => {
    if (!portfolioForm.name.trim() || selectedAssets.size === 0) {
      notifyError('Invalid Portfolio', 'Please enter a name and select at least one asset');
      return;
    }

    const newPortfolio: Portfolio = {
      id: `portfolio-${Date.now()}`,
      name: portfolioForm.name,
      description: portfolioForm.description,
      assets: Array.from(selectedAssets),
      totalValue: Array.from(selectedAssets).reduce((sum, assetId) => {
        const asset = assets.get(assetId);
        return sum + (asset?.totalRevenue || 0n);
      }, 0n),
      createdAt: new Date(),
      isPublic: portfolioForm.isPublic,
      bundledLicenseTerms: portfolioForm.bundledLicenseTerms
    };

    setPortfolios(prev => [...prev, newPortfolio]);
    setIsCreatingPortfolio(false);
    setSelectedAssets(new Set());
    setPortfolioForm({ name: '', description: '', isPublic: true, bundledLicenseTerms: '' });
    
    notifySuccess('Portfolio Created', `Successfully created portfolio "${newPortfolio.name}" with ${newPortfolio.assets.length} assets`);
  };

  // Toggle asset selection
  const toggleAssetSelection = (assetId: number) => {
    const newSelection = new Set(selectedAssets);
    if (newSelection.has(assetId)) {
      newSelection.delete(assetId);
    } else {
      newSelection.add(assetId);
    }
    setSelectedAssets(newSelection);
  };

  return (
    <div className="ip-portfolio">
      {/* Portfolio Header */}
      <div className="portfolio-header">
        <div className="portfolio-title">
          <h2>📊 IP Portfolio Dashboard</h2>
          <p>Manage your intellectual property assets and bundled rights</p>
          
          {/* Interactive Brand SVG */}
          <div className="brand-illustration">
            <svg
              width="600"
              height="300"
              viewBox="0 0 600 300"
              xmlns="http://www.w3.org/2000/svg"
              className="modred-brand-svg"
            >
              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="drop-shadow">
                  <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3"/>
                </filter>
              </defs>

              {/* Background Network Grid */}
              <g className="network-bg" opacity="0.1">
                {[...Array(12)].map((_, i) => (
                  <line 
                    key={`h-${i}`}
                    x1="0" 
                    y1={i * 25} 
                    x2="600" 
                    y2={i * 25} 
                    stroke="currentColor" 
                    strokeWidth="0.5"
                  />
                ))}
                {[...Array(24)].map((_, i) => (
                  <line 
                    key={`v-${i}`}
                    x1={i * 25} 
                    y1="0" 
                    x2={i * 25} 
                    y2="300" 
                    stroke="currentColor" 
                    strokeWidth="0.5"
                  />
                ))}
              </g>

              {/* Central Hub - Brain/Network Core */}
              <g className="central-hub">
                <circle 
                  cx="300" 
                  cy="150" 
                  r="50" 
                  fill="url(#primaryGradient)" 
                  filter="url(#glow)"
                  className="pulse-animation"
                />
                <circle 
                  cx="300" 
                  cy="150" 
                  r="35" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.8)" 
                  strokeWidth="3"
                  className="rotate-animation"
                />
                {/* Neural network pattern inside */}
                <g className="neural-pattern" opacity="0.9">
                  <circle cx="285" cy="135" r="4" fill="white" className="pulse-delay-1"/>
                  <circle cx="315" cy="135" r="4" fill="white" className="pulse-delay-2"/>
                  <circle cx="280" cy="165" r="4" fill="white" className="pulse-delay-3"/>
                  <circle cx="320" cy="165" r="4" fill="white" className="pulse-delay-1"/>
                  <circle cx="300" cy="150" r="5" fill="white" className="pulse-delay-2"/>
                  {/* Connecting lines */}
                  <line x1="285" y1="135" x2="300" y2="150" stroke="white" strokeWidth="1.5" opacity="0.7"/>
                  <line x1="315" y1="135" x2="300" y2="150" stroke="white" strokeWidth="1.5" opacity="0.7"/>
                  <line x1="280" y1="165" x2="300" y2="150" stroke="white" strokeWidth="1.5" opacity="0.7"/>
                  <line x1="320" y1="165" x2="300" y2="150" stroke="white" strokeWidth="1.5" opacity="0.7"/>
                </g>
              </g>

              {/* IP Asset Nodes */}
              <g className="asset-nodes">
                {/* Top Left - Document/Patent */}
                <g className="asset-node" transform="translate(120, 75)">
                  <rect 
                    width="60" 
                    height="45" 
                    rx="6" 
                    fill="url(#secondaryGradient)" 
                    filter="url(#drop-shadow)"
                    className="float-animation"
                  />
                  <rect x="8" y="8" width="30" height="3" fill="white" opacity="0.9"/>
                  <rect x="8" y="15" width="45" height="3" fill="white" opacity="0.7"/>
                  <rect x="8" y="22" width="38" height="3" fill="white" opacity="0.7"/>
                  <rect x="8" y="29" width="23" height="3" fill="white" opacity="0.5"/>
                  {/* Connection line to hub */}
                  <line x1="30" y1="45" x2="150" y2="105" stroke="url(#primaryGradient)" strokeWidth="3" opacity="0.6" className="pulse-line"/>
                </g>

                {/* Top Right - Image/Art */}
                <g className="asset-node" transform="translate(420, 60)">
                  <rect 
                    width="52" 
                    height="52" 
                    rx="6" 
                    fill="url(#accentGradient)" 
                    filter="url(#drop-shadow)"
                    className="float-animation-delay"
                  />
                  <circle cx="18" cy="18" r="9" fill="white" opacity="0.9"/>
                  <polygon points="8,38 25,23 38,30 45,38 45,45 8,45" fill="white" opacity="0.8"/>
                  {/* Connection line to hub */}
                  <line x1="26" y1="52" x2="-94" y2="98" stroke="url(#primaryGradient)" strokeWidth="3" opacity="0.6" className="pulse-line-delay"/>
                </g>

                {/* Bottom Left - Music/Audio */}
                <g className="asset-node" transform="translate(135, 195)">
                  <circle 
                    r="30" 
                    fill="url(#secondaryGradient)" 
                    filter="url(#drop-shadow)"
                    className="float-animation"
                  />
                  <path d="M-12,-12 L-12,12 L12,9 L12,-9 Z" fill="white" opacity="0.9"/>
                  <circle cx="6" cy="3" r="4.5" fill="white" opacity="0.7"/>
                  {/* Connection line to hub */}
                  <line x1="30" y1="0" x2="135" y2="-45" stroke="url(#primaryGradient)" strokeWidth="3" opacity="0.6" className="pulse-line"/>
                </g>

                {/* Bottom Right - Video/Media */}
                <g className="asset-node" transform="translate(465, 210)">
                  <rect 
                    width="52" 
                    height="38" 
                    rx="6" 
                    fill="url(#accentGradient)" 
                    filter="url(#drop-shadow)"
                    className="float-animation-delay"
                  />
                  <polygon points="18,12 18,26 33,19" fill="white" opacity="0.9"/>
                  <rect x="8" y="8" width="4" height="23" fill="white" opacity="0.5"/>
                  <rect x="39" y="8" width="4" height="23" fill="white" opacity="0.5"/>
                  {/* Connection line to hub */}
                  <line x1="0" y1="19" x2="-165" y2="-60" stroke="url(#primaryGradient)" strokeWidth="3" opacity="0.6" className="pulse-line-delay"/>
                </g>
              </g>

              {/* Blockchain Blocks */}
              <g className="blockchain-visualization" transform="translate(75, 255)">
                {[...Array(8)].map((_, i) => (
                  <g key={i} transform={`translate(${i * 60}, 0)`}>
                    <rect 
                      width="45" 
                      height="30" 
                      rx="4" 
                      fill={i % 2 === 0 ? "url(#primaryGradient)" : "url(#secondaryGradient)"} 
                      opacity="0.8"
                      className={`blockchain-block-${i % 3}`}
                    />
                    <rect x="4" y="4" width="36" height="3" fill="white" opacity="0.7"/>
                    <rect x="4" y="10" width="27" height="3" fill="white" opacity="0.5"/>
                    <rect x="4" y="16" width="30" height="3" fill="white" opacity="0.5"/>
                    <rect x="4" y="22" width="22" height="3" fill="white" opacity="0.3"/>
                    {/* Chain links */}
                    {i < 7 && (
                      <line 
                        x1="45" 
                        y1="15" 
                        x2="60" 
                        y2="15" 
                        stroke="url(#primaryGradient)" 
                        strokeWidth="4" 
                        opacity="0.7"
                      />
                    )}
                  </g>
                ))}
              </g>

              {/* Floating Particles */}
              <g className="floating-particles">
                <circle cx="75" cy="120" r="3" fill="url(#primaryGradient)" opacity="0.6" className="particle-float-1"/>
                <circle cx="525" cy="90" r="2.5" fill="url(#secondaryGradient)" opacity="0.7" className="particle-float-2"/>
                <circle cx="105" cy="180" r="2" fill="url(#accentGradient)" opacity="0.5" className="particle-float-3"/>
                <circle cx="495" cy="165" r="3" fill="url(#primaryGradient)" opacity="0.6" className="particle-float-1"/>
                <circle cx="45" cy="60" r="2.5" fill="url(#secondaryGradient)" opacity="0.8" className="particle-float-2"/>
                <circle cx="555" cy="240" r="2" fill="url(#accentGradient)" opacity="0.6" className="particle-float-3"/>
                <circle cx="90" cy="270" r="2.5" fill="url(#primaryGradient)" opacity="0.7" className="particle-float-1"/>
              </g>

              {/* Data Flow Lines */}
              <g className="data-flow" opacity="0.4">
                <path 
                  d="M 150 150 Q 225 120 300 150 Q 375 180 450 150" 
                  fill="none" 
                  stroke="url(#primaryGradient)" 
                  strokeWidth="3" 
                  strokeDasharray="8,8"
                  className="flow-animation"
                />
                <path 
                  d="M 180 180 Q 240 210 300 180 Q 360 150 420 180" 
                  fill="none" 
                  stroke="url(#secondaryGradient)" 
                  strokeWidth="3" 
                  strokeDasharray="5,5"
                  className="flow-animation-reverse"
                />
                <path 
                  d="M 120 200 Q 210 240 300 200 Q 390 160 480 200" 
                  fill="none" 
                  stroke="url(#accentGradient)" 
                  strokeWidth="2" 
                  strokeDasharray="6,6"
                  className="flow-animation"
                />
              </g>

              {/* License Tokens */}
              <g className="license-tokens" opacity="0.8">
                <g transform="translate(225, 45)">
                  <polygon 
                    points="0,15 15,0 30,15 15,30" 
                    fill="url(#accentGradient)" 
                    className="token-spin"
                  />
                  <text x="15" y="20" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">L</text>
                </g>
                <g transform="translate(345, 240)">
                  <polygon 
                    points="0,12 12,0 24,12 12,24" 
                    fill="url(#secondaryGradient)" 
                    className="token-spin-delay"
                  />
                  <text x="12" y="17" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">L</text>
                </g>
                <g transform="translate(480, 100)">
                  <polygon 
                    points="0,10 10,0 20,10 10,20" 
                    fill="url(#primaryGradient)" 
                    className="token-spin"
                  />
                  <text x="10" y="14" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">L</text>
                </g>
              </g>

              {/* Additional Decorative Elements */}
              <g className="decorative-elements" opacity="0.3">
                {/* Corner Accents */}
                <circle cx="30" cy="30" r="1" fill="url(#primaryGradient)" className="particle-float-1"/>
                <circle cx="570" cy="30" r="1" fill="url(#secondaryGradient)" className="particle-float-2"/>
                <circle cx="30" cy="270" r="1" fill="url(#accentGradient)" className="particle-float-3"/>
                <circle cx="570" cy="270" r="1" fill="url(#primaryGradient)" className="particle-float-1"/>
                
                {/* Side Network Lines */}
                <line x1="15" y1="50" x2="15" y2="250" stroke="url(#primaryGradient)" strokeWidth="1" opacity="0.4" strokeDasharray="2,4"/>
                <line x1="585" y1="50" x2="585" y2="250" stroke="url(#secondaryGradient)" strokeWidth="1" opacity="0.4" strokeDasharray="2,4"/>
                
                {/* Top and Bottom Network Lines */}
                <line x1="50" y1="15" x2="550" y2="15" stroke="url(#accentGradient)" strokeWidth="1" opacity="0.4" strokeDasharray="3,3"/>
                <line x1="50" y1="285" x2="550" y2="285" stroke="url(#primaryGradient)" strokeWidth="1" opacity="0.4" strokeDasharray="3,3"/>
              </g>
            </svg>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="portfolio-stats">
          <div className="stat-card">
            <div className="stat-icon">🎨</div>
            <div className="stat-content">
              <div className="stat-value">{totalAssets}</div>
              <div className="stat-label">IP Assets</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">{formatEther(totalRevenue)} tBNB</div>
              <div className="stat-label">Total Revenue</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <div className="stat-value">{activeLicenses}/{totalLicenses}</div>
              <div className="stat-label">Active Licenses</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-value">{portfolios.length}</div>
              <div className="stat-label">Portfolios</div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Navigation */}
      <div className="portfolio-nav">
        <button 
          className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`nav-btn ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          🎨 My Assets
        </button>
        <button 
          className={`nav-btn ${activeTab === 'portfolios' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolios')}
        >
          📦 Portfolios
        </button>
        <button 
          className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className="portfolio-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="overview-grid">
              {/* Recent Assets */}
              <div className="overview-card">
                <h3>🆕 Recent Assets</h3>
                <div className="recent-assets">
                  {userAssets.slice(0, 3).map(([id, asset]) => (
                    <div key={id} className="recent-asset">
                      <AssetPreview assetId={id} asset={asset} metadata={metadata.get(id)} />
                      <div className="recent-asset-info">
                        <div className="asset-name">{metadata.get(id)?.name || `Asset #${id}`}</div>
                        <div className="asset-revenue">{formatEther(asset.totalRevenue)} tBNB</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Portfolio Performance */}
              <div className="overview-card">
                <h3>📈 Performance</h3>
                <div className="performance-metrics">
                  <div className="metric">
                    <span className="metric-label">Average Revenue per Asset</span>
                    <span className="metric-value">
                      {totalAssets > 0 ? formatEther(totalRevenue / BigInt(totalAssets)) : '0'} tBNB
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">License Success Rate</span>
                    <span className="metric-value">
                      {totalLicenses > 0 ? Math.round((activeLicenses / totalLicenses) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="overview-card">
                <h3>⚡ Quick Actions</h3>
                <div className="quick-actions">
                  <button 
                    className="action-btn"
                    onClick={() => setActiveTab('assets')}
                  >
                    📝 Register New Asset
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => setIsCreatingPortfolio(true)}
                  >
                    📦 Create Portfolio
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => setActiveTab('analytics')}
                  >
                    📊 View Analytics
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <div className="assets-section">
            <div className="assets-header">
              <h3>🎨 My IP Assets ({userAssets.length})</h3>
              {selectedAssets.size > 0 && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsCreatingPortfolio(true)}
                >
                  📦 Create Portfolio ({selectedAssets.size} assets)
                </button>
              )}
            </div>
            
            <div className="assets-grid">
              {userAssets.map(([id, asset]) => (
                <div 
                  key={id} 
                  className={`asset-card ${selectedAssets.has(id) ? 'selected' : ''}`}
                  onClick={() => toggleAssetSelection(id)}
                >
                  <div className="asset-selection">
                    <input 
                      type="checkbox" 
                      checked={selectedAssets.has(id)}
                      onChange={() => toggleAssetSelection(id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <AssetPreview assetId={id} asset={asset} metadata={metadata.get(id)} />
                  
                  <div className="asset-info">
                    <h4>{metadata.get(id)?.name || `IP Asset #${id}`}</h4>
                    <p>{metadata.get(id)?.description || 'No description'}</p>
                    
                    <div className="asset-metrics">
                      <div className="metric">
                        <span>💰 Revenue</span>
                        <span>{formatEther(asset.totalRevenue)} tBNB</span>
                      </div>
                      <div className="metric">
                        <span>🎯 Royalty</span>
                        <span>{Number(asset.royaltyTokens) / 100}%</span>
                      </div>
                      <div className="metric">
                        <span>📅 Registered</span>
                        <span>{new Date(Number(asset.registrationDate) * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="asset-status">
                      {asset.isEncrypted && <span className="status-tag encrypted">🔒 Encrypted</span>}
                      {asset.isDisputed && <span className="status-tag disputed">⚠️ Disputed</span>}
                    </div>
                    
                    {onTransferIP && asset.owner.toLowerCase() === userAddress?.toLowerCase() && (
                      <div className="asset-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setTransferModal({ open: true, tokenId: id, recipient: '' })}
                          disabled={transferLoading || asset.isDisputed}
                          title={asset.isDisputed ? "Cannot transfer: IP asset has active disputes" : "Transfer this IP asset"}
                        >
                          🔄 Transfer
                        </button>
                        {asset.isDisputed && (
                          <small style={{ 
                            display: 'block', 
                            marginTop: '0.5rem', 
                            color: 'var(--color-error, #dc3545)',
                            fontSize: '0.75rem'
                          }}>
                            ⚠️ Active disputes must be resolved first
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {userAssets.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🎨</div>
                <h3>No IP Assets Yet</h3>
                <p>Register your first IP asset to start building your portfolio</p>
              </div>
            )}
          </div>
        )}

        {/* Portfolios Tab */}
        {activeTab === 'portfolios' && (
          <div className="portfolios-section">
            <div className="portfolios-header">
              <h3>📦 My Portfolios ({portfolios.length})</h3>
              <button 
                className="btn btn-primary"
                onClick={() => setIsCreatingPortfolio(true)}
              >
                ➕ Create New Portfolio
              </button>
            </div>
            
            <div className="portfolios-grid">
              {portfolios.map((portfolio) => (
                <div key={portfolio.id} className="portfolio-card">
                  <div className="portfolio-header">
                    <h4>{portfolio.name}</h4>
                    <div className="portfolio-badges">
                      {portfolio.isPublic && <span className="badge public">🌐 Public</span>}
                      <span className="badge assets">{portfolio.assets.length} assets</span>
                    </div>
                  </div>
                  
                  <p>{portfolio.description}</p>
                  
                  <div className="portfolio-preview">
                    {portfolio.assets.slice(0, 4).map((assetId) => {
                      const asset = assets.get(assetId);
                      return asset ? (
                        <AssetPreview 
                          key={assetId}
                          assetId={assetId} 
                          asset={asset} 
                          metadata={metadata.get(assetId)} 
                        />
                      ) : null;
                    })}
                    {portfolio.assets.length > 4 && (
                      <div className="portfolio-more">+{portfolio.assets.length - 4}</div>
                    )}
                  </div>
                  
                  <div className="portfolio-metrics">
                    <div className="metric">
                      <span>💰 Total Value</span>
                      <span>{formatEther(portfolio.totalValue)} tBNB</span>
                    </div>
                    <div className="metric">
                      <span>📅 Created</span>
                      <span>{portfolio.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="portfolio-actions">
                    <button className="btn btn-secondary">📝 Edit</button>
                    <button className="btn btn-primary">🎫 License Bundle</button>
                  </div>
                </div>
              ))}
            </div>
            
            {portfolios.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No Portfolios Yet</h3>
                <p>Create portfolios to bundle your IP assets and offer comprehensive licensing packages</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <h3>📈 Portfolio Analytics</h3>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Revenue Distribution</h4>
                <div className="revenue-chart">
                  {userAssets.map(([id, asset]) => (
                    <div key={id} className="revenue-bar">
                      <div className="bar-label">{metadata.get(id)?.name || `Asset #${id}`}</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill"
                          style={{ 
                            width: totalRevenue > 0n ? `${Number(asset.totalRevenue * 100n / totalRevenue)}%` : '0%' 
                          }}
                        ></div>
                      </div>
                      <div className="bar-value">{formatEther(asset.totalRevenue)} tBNB</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="analytics-card">
                <h4>Asset Performance</h4>
                <div className="performance-list">
                  {userAssets
                    .sort(([,a], [,b]) => Number(b.totalRevenue - a.totalRevenue))
                    .slice(0, 5)
                    .map(([id, asset]) => (
                      <div key={id} className="performance-item">
                        <AssetPreview assetId={id} asset={asset} metadata={metadata.get(id)} />
                        <div className="performance-info">
                          <div className="asset-name">{metadata.get(id)?.name || `Asset #${id}`}</div>
                          <div className="asset-revenue">{formatEther(asset.totalRevenue)} tBNB</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Portfolio Modal */}
      {isCreatingPortfolio && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📦 Create New Portfolio</h3>
              <button 
                className="modal-close"
                onClick={() => setIsCreatingPortfolio(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Portfolio Name</label>
                <input
                  type="text"
                  value={portfolioForm.name}
                  onChange={(e) => setPortfolioForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter portfolio name"
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={portfolioForm.description}
                  onChange={(e) => setPortfolioForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your portfolio"
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Bundled License Terms</label>
                <textarea
                  value={portfolioForm.bundledLicenseTerms}
                  onChange={(e) => setPortfolioForm(prev => ({ ...prev, bundledLicenseTerms: e.target.value }))}
                  placeholder="Define licensing terms for the entire portfolio"
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={portfolioForm.isPublic}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
                  Make portfolio publicly visible
                </label>
              </div>
              
              <div className="selected-assets">
                <h4>Selected Assets ({selectedAssets.size})</h4>
                <div className="asset-chips">
                  {Array.from(selectedAssets).map((assetId) => (
                    <div key={assetId} className="asset-chip">
                      {metadata.get(assetId)?.name || `Asset #${assetId}`}
                      <button onClick={() => toggleAssetSelection(assetId)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setIsCreatingPortfolio(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={createPortfolio}
                disabled={!portfolioForm.name.trim() || selectedAssets.size === 0}
              >
                Create Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal.open && transferModal.tokenId !== null && (
        <div className="modal-overlay" onClick={() => setTransferModal({ open: false, tokenId: null, recipient: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔄 Transfer IP Asset #{transferModal.tokenId}</h3>
              <button 
                className="modal-close"
                onClick={() => setTransferModal({ open: false, tokenId: null, recipient: '' })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">👤 Recipient Address</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0x..."
                  value={transferModal.recipient}
                  onChange={(e) => setTransferModal({ ...transferModal, recipient: e.target.value.trim() })}
                />
                <small className="form-hint">
                  Enter the Ethereum address of the recipient. The IP asset will be transferred to this address.
                </small>
              </div>
              
              {metadata.get(transferModal.tokenId) && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'var(--color-bg-secondary, #f5f5f5)', 
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <div><strong>Asset:</strong> {metadata.get(transferModal.tokenId)?.name || `IP Asset #${transferModal.tokenId}`}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setTransferModal({ open: false, tokenId: null, recipient: '' })}
                disabled={transferLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!transferModal.recipient || !transferModal.recipient.trim()) {
                    notifyError("Invalid Input", "Please enter a recipient address");
                    return;
                  }
                  if (!transferModal.recipient.startsWith("0x") || transferModal.recipient.length !== 42) {
                    notifyError("Invalid Address", "Please enter a valid Ethereum address (0x...)");
                    return;
                  }
                  if (onTransferIP) {
                    setTransferLoading(true);
                    try {
                      await onTransferIP(transferModal.tokenId!, transferModal.recipient);
                      setTransferModal({ open: false, tokenId: null, recipient: '' });
                    } catch (error) {
                      console.error("Transfer error:", error);
                    } finally {
                      setTransferLoading(false);
                    }
                  }
                }}
                disabled={transferLoading || !transferModal.recipient.trim()}
              >
                {transferLoading ? '⏳ Transferring...' : '🔄 Transfer IP Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};