// Configuration
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];
  
  // State
  let socket;
  let peers = new Map();
  let myId = null;
  let myName = 'Anonymous';
  
  // DOM Elements
  const statusEl = document.getElementById('status');
  const usernameInput = document.getElementById('username');
  const setUsernameBtn = document.getElementById('set-username');
  const userListEl = document.getElementById('user-list');
  const userCountEl = document.getElementById('user-count');
  const peerListEl = document.getElementById('peer-list');
  const messagesEl = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  
  // Initialize socket connection
  function initSocket() {
    socket = io();
  
    socket.on('connect', () => {
      myId = socket.id;
      updateStatus('connected', 'Connected');
      console.log('✅ Connected to signaling server:', myId);
      
      socket.emit('join', { name: myName });
    });
  
    socket.on('disconnect', () => {
      updateStatus('disconnected', 'Disconnected');
      console.log('❌ Disconnected from signaling server');
    });
  
    socket.on('users', (users) => {
      updateUserList(users);
    });
  
    socket.on('signal', (data) => {
      handleSignal(data);
    });
  
    socket.on('user-joined', (data) => {
      addSystemMessage(`${data.userName} joined the chat`);
    });
  }
  
  // Update connection status
  function updateStatus(status, text) {
    statusEl.className = `status ${status}`;
    statusEl.textContent = text;
  }
  
  // Update user list
  function updateUserList(users) {
    userCountEl.textContent = users.length;
    userListEl.innerHTML = '';
    
    users.forEach(user => {
      if (user.id === myId) return; // Skip self
      
      const li = document.createElement('li');
      li.className = 'user-item';
      
      const isConnected = peers.has(user.id);
      const peerData = peers.get(user.id);
      const isReady = isConnected && peerData?.connected;
      
      li.innerHTML = `
        <span>${user.name} ${isReady ? '🟢' : ''}</span>
        <button class="connect-btn" data-id="${user.id}">
          ${isReady ? '✓ Connected' : isConnected ? 'Connecting...' : 'Connect'}
        </button>
      `;
      
      const btn = li.querySelector('.connect-btn');
      if (isReady) {
        btn.disabled = true;
      } else {
        btn.onclick = () => connectToPeer(user.id, user.name);
      }
      
      userListEl.appendChild(li);
    });
  }
  
  // Update peer list
  function updatePeerList() {
    peerListEl.innerHTML = '';
    
    let connectedCount = 0;
    peers.forEach((peerData, peerId) => {
      if (peerData.connected) {
        connectedCount++;
        const li = document.createElement('li');
        li.className = 'peer-item';
        li.innerHTML = `
          <span>🟢 ${peerData.name}</span>
          <button class="disconnect-btn" data-id="${peerId}">×</button>
        `;
        
        li.querySelector('.disconnect-btn').onclick = () => {
          disconnectPeer(peerId);
        };
        
        peerListEl.appendChild(li);
      }
    });
    
    // Enable/disable message input
    const hasConnections = connectedCount > 0;
    messageInput.disabled = !hasConnections;
    sendBtn.disabled = !hasConnections;
    messageInput.placeholder = hasConnections 
      ? 'Type a message...' 
      : 'Connect to a peer first';
  }
  
  // Connect to a peer
  function connectToPeer(peerId, peerName) {
    if (peers.has(peerId)) {
      console.log('⚠️ Already connected/connecting to', peerId);
      return;
    }
  
    console.log('🔄 Initiating connection to', peerId, peerName);
    
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      config: { iceServers: ICE_SERVERS }
    });
  
    const peerData = {
      peer: peer,
      name: peerName,
      connected: false
    };
    
    peers.set(peerId, peerData);
    setupPeerEvents(peer, peerId, peerName, peerData);
    
    peer.on('signal', (signal) => {
      console.log('📤 Sending signal to', peerId);
      socket.emit('signal', {
        signal: signal,
        to: peerId
      });
    });
    
    updateUserList([]);
  }
  
  // Handle incoming signal
  function handleSignal(data) {
    const { signal, from, name } = data;
    
    console.log('📥 Received signal from', from, name);
    
    if (!peers.has(from)) {
      console.log('🔄 Creating peer connection with', from, name);
      
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: { iceServers: ICE_SERVERS }
      });
  
      const peerData = {
        peer: peer,
        name: name,
        connected: false
      };
      
      peers.set(from, peerData);
      setupPeerEvents(peer, from, name, peerData);
      
      peer.on('signal', (sig) => {
        console.log('📤 Sending response signal to', from);
        socket.emit('signal', {
          signal: sig,
          to: from
        });
      });
      
      peer.signal(signal);
    } else {
      console.log('📥 Signaling existing peer', from);
      peers.get(from).peer.signal(signal);
    }
  }
  
  // Setup peer event handlers
  function setupPeerEvents(peer, peerId, peerName, peerData) {
    peer.on('connect', () => {
      console.log('✅ P2P connection established with', peerId);
      peerData.connected = true;
      addSystemMessage(`Connected to ${peerName} - You can now send messages!`);
      updatePeerList();
      updateUserList([]);
    });
  
    peer.on('data', (data) => {
      try {
        const message = data.toString();
        console.log('📩 Received message from', peerId, ':', message);
        addMessage(peerName, message, false);
      } catch (err) {
        console.error('❌ Error parsing message:', err);
      }
    });
  
    peer.on('error', (err) => {
      console.error('❌ Peer error with', peerId, ':', err);
      addSystemMessage(`Connection error with ${peerName}: ${err.message}`);
    });
  
    peer.on('close', () => {
      console.log('🔌 Peer connection closed:', peerId);
      disconnectPeer(peerId);
    });
  
    // Monitor connection state
    peer._pc.addEventListener('connectionstatechange', () => {
      console.log(`🔍 Connection state for ${peerName}:`, peer._pc.connectionState);
    });
  
    peer._pc.addEventListener('iceconnectionstatechange', () => {
      console.log(`🔍 ICE state for ${peerName}:`, peer._pc.iceConnectionState);
    });
  }
  
  // Disconnect from peer
  function disconnectPeer(peerId) {
    const peerData = peers.get(peerId);
    if (peerData) {
      try {
        peerData.peer.destroy();
      } catch (err) {
        console.error('Error destroying peer:', err);
      }
      peers.delete(peerId);
      addSystemMessage(`Disconnected from ${peerData.name}`);
      updatePeerList();
      updateUserList([]);
    }
  }
  
  // Send message to all connected peers
  function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) {
      console.log('⚠️ Empty message, not sending');
      return;
    }
  
    const connectedPeers = Array.from(peers.entries()).filter(([_, data]) => data.connected);
    
    if (connectedPeers.length === 0) {
      addSystemMessage('❌ No active connections. Connect to a peer first.');
      console.log('⚠️ No connected peers available');
      return;
    }
  
    console.log(`📤 Sending message to ${connectedPeers.length} peer(s):`, message);
  
    let sentCount = 0;
    let errorCount = 0;
  
    // Send to all connected peers
    connectedPeers.forEach(([peerId, peerData]) => {
      try {
        if (peerData.peer && peerData.connected) {
          peerData.peer.send(message);
          console.log('✅ Message sent to', peerData.name);
          sentCount++;
        } else {
          console.log('⚠️ Peer not ready:', peerData.name);
          errorCount++;
        }
      } catch (err) {
        console.error('❌ Failed to send message to', peerId, err);
        addSystemMessage(`Failed to send to ${peerData.name}`);
        errorCount++;
      }
    });
  
    if (sentCount > 0) {
      addMessage('You', message, true);
      messageInput.value = '';
      console.log(`✅ Message sent successfully to ${sentCount} peer(s)`);
    }
    
    if (errorCount > 0) {
      addSystemMessage(`⚠️ Failed to send to ${errorCount} peer(s)`);
    }
  }
  
  // Add message to chat
  function addMessage(sender, text, isSent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <strong>${escapeHtml(sender)}</strong>
        <span class="timestamp">${timestamp}</span>
      </div>
      <div class="message-content">${escapeHtml(text)}</div>
    `;
    
    messagesEl.appendChild(messageDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  // Add system message
  function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `
      <span class="system-icon">ℹ️</span>
      <span>${escapeHtml(text)}</span>
    `;
    messagesEl.appendChild(messageDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Event Listeners
  setUsernameBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
      myName = name;
      socket.emit('join', { name: myName });
      addSystemMessage(`Name set to: ${myName}`);
      usernameInput.value = '';
    }
  });
  
  sendBtn.addEventListener('click', sendMessage);
  
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Initialize on page load
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application starting...');
    initSocket();
    addSystemMessage('Welcome! Set your name and connect to other users to start chatting.');
    addSystemMessage('All messages are encrypted end-to-end using WebRTC DTLS. 🔒');
    
    // Open browser console to see debug logs
    console.log('💡 Tip: Keep the browser console open to see connection logs');
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    console.log('🧹 Cleaning up connections...');
    peers.forEach((peerData) => {
      try {
        peerData.peer.destroy();
      } catch (err) {
        console.error('Error during cleanup:', err);
      }
    });
    if (socket) {
      socket.disconnect();
    }
  });
  