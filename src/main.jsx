import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from './config/wagmi.js'
import { WalletProvider } from './contexts/WalletContext.jsx'
import App from './App.jsx'
import './index.css'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

class EB extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(e) { return { err: e } }
  render() {
    if (this.state.err) return (
      <div style={{padding:20,color:'#f66',fontFamily:'monospace',background:'#0a0a0a',minHeight:'100vh'}}>
        <h2>Error: {this.state.err.message}</h2>
        <pre style={{fontSize:11,color:'#888',whiteSpace:'pre-wrap'}}>{this.state.err.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <EB>
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={qc}>
        <WalletProvider>
          <EB><App /></EB>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </EB>
)
